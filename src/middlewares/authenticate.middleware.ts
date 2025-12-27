import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "~/configs/env";
import { errorResponse } from "~/utils/response";

const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token: string | undefined;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return errorResponse(res, 401, "Token không tồn tại");
  }

  try {
    const decoded = jwt.verify(token, ENV.accessTokenSecret);
    req.user = decoded;

    next();
  } catch (error) {
    return errorResponse(res, 401, "Token không hợp lệ");
  }
};

export default authenticate;
