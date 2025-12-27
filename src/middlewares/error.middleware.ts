import type { NextFunction, Request, Response } from "express";

interface ErrorHandler extends Error {
  status?: number;
}

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (
  error: ErrorHandler,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status: number = res.statusCode === 200 ? 500 : res.statusCode;
  return res.status(status).json({
    success: false,
    message: error?.message,
  });
};
