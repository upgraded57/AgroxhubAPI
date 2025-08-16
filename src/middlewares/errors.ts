import { Request, Response, NextFunction } from "express";
import { HttpExceptions } from "../exceptions/root";

export const errorCatcher = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((error: Error) => {
      next(error);
    });
  };
};

export const errorHandler = (
  error: HttpExceptions,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;

  // console.log(error);
  // Return JSON error response
  res.status(statusCode).json({
    status: false,
    message: error.message || "Internal Server Error",
    errors: error.errors || null,
  });
};
