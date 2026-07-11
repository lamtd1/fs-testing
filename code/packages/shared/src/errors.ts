// Custom error class -> phân biệt lỗi "chủ động" (biết trước) với lỗi bất ngờ.
// DÙNG CHUNG cho mọi service: cùng một hình dạng lỗi -> gateway/FE xử lý thống nhất.
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

export const NotFound = (msg = "Không tìm thấy") => new AppError(404, msg, "NOT_FOUND");
export const BadRequest = (msg = "Yêu cầu không hợp lệ", details?: unknown) =>
  new AppError(400, msg, "BAD_REQUEST", details);
export const Conflict = (msg = "Dữ liệu đã tồn tại") => new AppError(409, msg, "CONFLICT");
export const Unauthorized = (msg = "Chưa xác thực") => new AppError(401, msg, "UNAUTHORIZED");
export const Forbidden = (msg = "Không có quyền") => new AppError(403, msg, "FORBIDDEN");
export const ServiceUnavailable = (msg = "Dịch vụ tạm thời không khả dụng") =>
  new AppError(503, msg, "SERVICE_UNAVAILABLE");
