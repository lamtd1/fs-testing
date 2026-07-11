// Custom error class -> giúp phân biệt lỗi "chủ động" (biết trước) với lỗi bất ngờ.
// Service/Controller ném AppError; error middleware bắt và trả response chuẩn.

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Vài helper cho gọn:
export const NotFound = (msg = "Không tìm thấy") =>
  new AppError(404, msg, "NOT_FOUND");

export const BadRequest = (msg = "Yêu cầu không hợp lệ", details?: unknown) =>
  new AppError(400, msg, "BAD_REQUEST", details);

export const Conflict = (msg = "Dữ liệu đã tồn tại") =>
  new AppError(409, msg, "CONFLICT");

export const Unauthorized = (msg = "Chưa xác thực") =>
  new AppError(401, msg, "UNAUTHORIZED");

export const Forbidden = (msg = "Không có quyền") =>
  new AppError(403, msg, "FORBIDDEN");
