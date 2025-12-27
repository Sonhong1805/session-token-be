import { Request, Response } from "express";
import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";
import argon2 from "argon2";
import ms from "ms";
import { errorResponse, successResponse } from "~/utils/response";
import { ENV } from "~/configs/env";

interface User {
  id: number;
  email: string;
  username: string;
  hashPassword: string;
  refreshToken: string | null;
  [key: string]: any;
}

let users: User[] = [
  {
    id: 1,
    email: "user@gmail.com",
    username: "user",
    hashPassword: "",
    refreshToken: null,
  },
];

// Database helper functions
const findUserByEmailOrUsername = async (
  identifier: string
): Promise<User | null> => {
  return (
    users.find(
      (u) => u.email === identifier || u.username === identifier
    ) || null
  );
};

const findUserById = async (id: number): Promise<User | null> => {
  return users.find((u) => u.id === id) || null;
};

const findUserByRefreshToken = async (
  refreshToken: string
): Promise<User | null> => {
  return users.find((u) => u.refreshToken === refreshToken) || null;
};

const updateUser = async (id: number, updates: Partial<User>): Promise<void> => {
  const userIndex = users.findIndex((u) => u.id === id);
  if (userIndex !== -1) {
    users[userIndex] = { ...users[userIndex], ...updates } as User;
  }
};

const createUser = async (userData: Omit<User, "id" | "refreshToken">): Promise<User> => {
  const newId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
  const newUser: User = {
    id: newId,
    email: userData.email,
    username: userData.username,
    hashPassword: userData.hashPassword,
    refreshToken: null,
  };
  users.push(newUser);
  return newUser;
};

const findUserByEmail = async (email: string): Promise<User | null> => {
  return users.find((u) => u.email === email) || null;
};

const findUserByUsername = async (username: string): Promise<User | null> => {
  return users.find((u) => u.username === username) || null;
};

class AuthController {
  register = async (req: Request, res: Response) => {
    try {
      const { email, username, password } = req.body;

      // Validation
      if (!email || !username || !password) {
        return errorResponse(
          res,
          400,
          "Vui lòng nhập đầy đủ thông tin (email, username, password)"
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return errorResponse(res, 400, "Email không hợp lệ");
      }

      // Validate password length
      if (password.length < 6) {
        return errorResponse(
          res,
          400,
          "Mật khẩu phải có ít nhất 6 ký tự"
        );
      }

      // Check if email already exists
      const existingUserByEmail = await findUserByEmail(email);
      if (existingUserByEmail) {
        return errorResponse(res, 409, "Email đã được sử dụng");
      }

      // Check if username already exists
      const existingUserByUsername = await findUserByUsername(username);
      if (existingUserByUsername) {
        return errorResponse(res, 409, "Username đã được sử dụng");
      }

      // Hash password
      const hashPassword = await argon2.hash(password);

      // Create new user
      const newUser = await createUser({
        email,
        username,
        hashPassword,
      });

      const { hashPassword: _, refreshToken: __, ...userPayload } = newUser;

      // Auto login after registration (optional)
      const accessToken = await this.createAccessToken({
        ...userPayload,
        entityType: "user",
      });
      const refreshToken = await this.createRefreshToken(userPayload);

      await updateUser(newUser.id, { refreshToken });

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        maxAge: ms(ENV.refreshTokenExpires as ms.StringValue),
        secure: true,
        sameSite: "none",
        path: "/",
      });

      return successResponse(res, 201, "Đăng ký thành công", {
        accessToken,
        user: userPayload,
      });
    } catch (error) {
      console.error("Register error:", error);
      return errorResponse(res, 500, "Lỗi server khi đăng ký");
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return errorResponse(res, 400, "Vui lòng nhập đầy đủ thông tin");
      }

      const user = await findUserByEmailOrUsername(username);

      if (!user) {
        return errorResponse(
          res,
          404,
          "Tài khoản không tồn tại. Vui lòng kiểm tra lại thông tin đăng nhập."
        );
      }

      if (!user.hashPassword) {
        return errorResponse(
          res,
          400,
          "Tài khoản chưa được thiết lập mật khẩu"
        );
      }

      const isPasswordValid = await argon2.verify(
        user.hashPassword,
        password + ""
      );

      if (!isPasswordValid) {
        return errorResponse(res, 400, "Mật khẩu không chính xác");
      }

      const { hashPassword, refreshToken, ...userPayload } = user;

      const newAccessToken = await this.createAccessToken({
        ...userPayload,
        entityType: "user",
      });
      const newRefreshToken = await this.createRefreshToken(userPayload);

      await updateUser(user.id, { refreshToken: newRefreshToken });

      res.cookie("refresh_token", newRefreshToken, {
        httpOnly: true,
        maxAge: ms(ENV.refreshTokenExpires as ms.StringValue),
        secure: true,
        sameSite: "none", // MUST for cross site
        path: "/",
      });

      return successResponse(res, 200, "Đăng nhập thành công", {
        accessToken: newAccessToken,
        user: userPayload,
      });
    } catch (error) {
      console.error("Login error:", error);
      return errorResponse(res, 500, "Lỗi server");
    }
  };

  refreshToken = async (req: Request, res: Response) => {
    try {
      const refreshTokenCookie = req.cookies["refresh_token"];

      if (!refreshTokenCookie) {
        return errorResponse(res, 400, "Refresh token không tồn tại");
      }

      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(
          refreshTokenCookie,
          ENV.refreshTokenSecret as string
        ) as JwtPayload;
      } catch (error) {
        return errorResponse(res, 400, "Token không hợp lệ");
      }

      const user = await findUserByRefreshToken(refreshTokenCookie);

      if (!user) {
        return errorResponse(res, 404, "User not found");
      }

      const { hashPassword, refreshToken, ...userPayload } = user;

      const newAccessToken = await this.createAccessToken(userPayload);
      const newRefreshToken = await this.createRefreshToken(userPayload);

      await updateUser(user.id, { refreshToken: newRefreshToken });

      res.cookie("refresh_token", newRefreshToken, {
        httpOnly: true,
        maxAge: ms(ENV.refreshTokenExpires as ms.StringValue),
        secure: true,
        sameSite: "none", // MUST for cross site
        path: "/",
      });

      return successResponse(res, 200, "Refresh Token successfully", {
        accessToken: newAccessToken,
        user: userPayload,
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      return errorResponse(res, 400, "Refresh Token failed");
    }
  };

  createAccessToken = async (payload: any): Promise<string> => {
    const accessToken = jwt.sign(
      payload,
      ENV.accessTokenSecret as string,
      {
        expiresIn: ENV.accessTokenExpires as string | number,
      } as SignOptions
    );
    return accessToken;
  };

  createRefreshToken = async (payload: any): Promise<string> => {
    const refreshToken = jwt.sign(
      payload,
      ENV.refreshTokenSecret as string,
      {
        expiresIn: ENV.refreshTokenExpires as string | number,
      } as SignOptions
    );
    return refreshToken;
  };

  me = async (req: Request, res: Response) => {
    try {
      if (req.user) {
        const decoded = req.user as JwtPayload;
        const userId = typeof decoded.id === "string" ? parseInt(decoded.id) : decoded.id;

        const user = await findUserById(userId);

        if (!user) {
          return errorResponse(res, 404, "Tài khoản user không tồn tại");
        }

        const { hashPassword, refreshToken, ...userPayload } = user;

        return successResponse(res, 200, "User me", userPayload);
      }

      return errorResponse(res, 401, "Unauthorized");
    } catch (error) {
      console.error("Error in /me:", error);
      return errorResponse(res, 500, "Lỗi server");
    }
  };

  getAllUsers = async (req: Request, res: Response) => {
    try {
      // Lấy tất cả users và loại bỏ thông tin nhạy cảm
      const allUsers = users.map((user) => {
        const { hashPassword, refreshToken, ...userPayload } = user;
        return userPayload;
      });

      return successResponse(res, 200, "Lấy danh sách users thành công", {
        users: allUsers,
        total: allUsers.length,
      });
    } catch (error) {
      console.error("Get all users error:", error);
      return errorResponse(res, 500, "Lỗi server khi lấy danh sách users");
    }
  };

  logout = async (req: Request, res: Response) => {
    try {
      const refreshTokenCookie = req.cookies["refresh_token"];

      if (!refreshTokenCookie) {
        return errorResponse(res, 400, "Refresh token không tồn tại");
      }

      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(
          refreshTokenCookie,
          ENV.refreshTokenSecret as string
        ) as JwtPayload;
      } catch (error) {
        return errorResponse(res, 400, "Token không hợp lệ");
      }

      const userId = typeof decoded.id === "string" ? parseInt(decoded.id) : decoded.id;
      const user = await findUserById(userId);

      if (!user) {
        return errorResponse(res, 404, "User not found");
      }

      await updateUser(user.id, { refreshToken: null });
      res.clearCookie("refresh_token");

      return successResponse(res, 200, "Logout successfully");
    } catch (error) {
      console.error("Logout error:", error);
      return errorResponse(res, 400, "Logout failed");
    }
  };
}

export default new AuthController();
