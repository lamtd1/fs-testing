// Error middleware TẬP TRUNG: mọi lỗi (next(err) hoặc async reject) đổ về đây.
// Trả về response JSON theo một format thống nhất cho toàn hệ thống.
import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

// 404 cho route không khớp — đặt SAU tất cả route.
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Không tìm thấy ${req.method} ${req.path}` },
    requestId: req.id,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // 1) Lỗi chủ động của app
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
      requestId: req.id,
    });
  }

  // 2) Lỗi Prisma thường gặp (map sang HTTP hợp lý)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: { code: "CONFLICT", message: "Giá trị đã tồn tại (unique constraint)" },
        requestId: req.id,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Bản ghi không tồn tại" },
        requestId: req.id,
      });
    }
  }

  // 3) Lỗi không lường trước -> log full, trả 500 (giấu chi tiết ở production)
  logger.error({ err, requestId: req.id }, "Unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "Lỗi hệ thống"
          : err instanceof Error
            ? err.message
            : "Unknown error",
    },
    requestId: req.id,
  });
}
