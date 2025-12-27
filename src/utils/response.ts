import type { Response } from "express";

export const successResponse = (
  res: Response,
  status: number = 200,
  message: string = "OK",
  data?: any
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  status: number = 500,
  message: String = "Error",
  error?: any
) => {
  return res.status(status).json({
    success: false,
    message,
    error,
  });
};
