// Middleware HTTP dùng chung: correlation-id + 404 + error handler.
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errors.js";
import type { Logger } from "./logger.js";
import { requestContext } from "./context.js";

// Header mang correlation-id XUYÊN các service. Nối tiếp x-request-id của Phần 1.
export const REQUEST_ID_HEADER = "x-request-id";

// Gán req.id: nếu request đến đã có id (từ gateway/service khác) -> GIỮ NGUYÊN,
// nhờ vậy 1 hành động user đi qua nhiều service vẫn cùng 1 id -> gộp log được.
// Đồng thời đặt id vào AsyncLocalStorage -> tầng sâu (user-client) đọc lại được
// để truyền tiếp sang service kế -> correlation-id chạy suốt chuỗi.
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming ?? randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  requestContext.run({ requestId: id }, () => next());
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Không tìm thấy ${req.method} ${req.path}` },
    requestId: req.id,
  });
}

// Error handler cần biết môi trường (giấu chi tiết ở prod) + logger của service.
// Duck-type lỗi Prisma (P2002/P2025) để KHÔNG phụ thuộc @prisma/client trong shared.
export function createErrorHandler(opts: { nodeEnv: string; logger: Logger }) {
  return function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: { code: err.code, message: err.message, details: err.details },
        requestId: req.id,
      });
    }

    if (typeof err === "object" && err !== null && "code" in err) {
      const code = (err as { code?: unknown }).code;
      if (code === "P2002") {
        return res.status(409).json({
          error: { code: "CONFLICT", message: "Giá trị đã tồn tại (unique constraint)" },
          requestId: req.id,
        });
      }
      if (code === "P2025") {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Bản ghi không tồn tại" },
          requestId: req.id,
        });
      }
    }

    opts.logger.error({ err, requestId: req.id }, "Unhandled error");
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message:
          opts.nodeEnv === "production"
            ? "Lỗi hệ thống"
            : err instanceof Error
              ? err.message
              : "Unknown error",
      },
      requestId: req.id,
    });
  };
}
