// Express 4 không tự bắt lỗi từ async handler -> phải wrap để .catch(next).
// (Express 5 sẽ tự làm việc này, nhưng ta viết tường minh cho rõ.)
import type { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
