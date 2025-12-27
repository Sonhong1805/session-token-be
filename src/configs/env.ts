import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  port: process.env.PORT || 8000,
  apiVersion: process.env.API_VERSION || "/api/v1",
  clientUrl: process.env.CLIENT_URL || "",
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || "",
  accessTokenExpires: process.env.JWT_ACCESS_EXPIRES || "",
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || "",
  refreshTokenExpires: process.env.JWT_REFRESH_EXPIRES || "",
};
