// Xác thực JWT dùng chung. auth-service CẤP token; các service khác (user-service,
// và sau này gateway ở Phần 7) chỉ cần VERIFY -> nên phần verify để ở shared.
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Unauthorized, Forbidden } from "./errors.js";

// Không import Role từ Prisma (mỗi service có client riêng) -> định nghĩa union
// dùng chung ở đây. Prisma enum Role sinh ra cũng là "USER" | "ADMIN" nên khớp.
export type Role = "USER" | "ADMIN";

// Payload nhét trong access token (JWT).
export interface AuthUser {
  sub: string; // userId
  email: string;
  role: Role;
}

// Tạo middleware authenticate cho một service, với secret của nó.
// Verify access token trong "Authorization: Bearer <token>" -> gán req.user.
export function createAuthenticate(accessSecret: string): RequestHandler {
  return (req, _res, next) => {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) return next(Unauthorized("Thiếu access token"));
    const token = header.slice("Bearer ".length);
    try {
      req.user = jwt.verify(token, accessSecret) as AuthUser;
      next();
    } catch {
      next(Unauthorized("Access token không hợp lệ hoặc đã hết hạn"));
    }
  };
}

// RBAC: dùng SAU authenticate.
export function authorize(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(Unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(Forbidden("Bạn không có quyền truy cập tài nguyên này"));
    }
    next();
  };
}
