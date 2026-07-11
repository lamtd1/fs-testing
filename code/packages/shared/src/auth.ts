// Xác thực JWT dùng chung. auth-service CẤP token; gateway (Phần 7) VERIFY một lần
// rồi truyền context xuống service qua header tin cậy.
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

// Header GATEWAY gắn khi đã verify JWT (7.3) -> service tin thay vì verify lại.
export const USER_ID_HEADER = "x-user-id";
export const USER_EMAIL_HEADER = "x-user-email";
export const USER_ROLE_HEADER = "x-user-role";
// "Bằng chứng" request đến từ gateway thật (shared secret), không phải kẻ giả mạo.
export const GATEWAY_TOKEN_HEADER = "x-gateway-token";

// Verify access token thuần (dùng ở gateway + trong createAuthenticate).
export function verifyAccessToken(token: string, secret: string): AuthUser {
  try {
    return jwt.verify(token, secret) as AuthUser;
  } catch {
    throw Unauthorized("Access token không hợp lệ hoặc đã hết hạn");
  }
}

// Middleware verify JWT tại chỗ (service tự verify). Từ 7.3 phần lớn service KHÔNG
// dùng cái này nữa mà dùng trustGatewayUser; giữ lại cho nơi cần verify độc lập.
export function createAuthenticate(accessSecret: string): RequestHandler {
  return (req, _res, next) => {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) return next(Unauthorized("Thiếu access token"));
    try {
      req.user = verifyAccessToken(header.slice("Bearer ".length), accessSecret);
      next();
    } catch (err) {
      next(err);
    }
  };
}

// (7.3) Service TIN context do gateway gắn, thay vì tự verify JWT.
// Trước khi tin x-user-*, kiểm tra x-gateway-token khớp secret dùng chung ->
// bằng chứng request đi qua gateway (chống gọi thẳng service với header giả).
export function trustGatewayUser(gatewaySecret: string): RequestHandler {
  return (req, _res, next) => {
    const proof = req.header(GATEWAY_TOKEN_HEADER);
    if (!proof || proof !== gatewaySecret) {
      return next(Unauthorized("Yêu cầu phải đi qua API gateway"));
    }
    const sub = req.header(USER_ID_HEADER);
    const role = req.header(USER_ROLE_HEADER) as Role | undefined;
    if (!sub || (role !== "USER" && role !== "ADMIN")) {
      return next(Unauthorized("Thiếu ngữ cảnh người dùng từ gateway"));
    }
    req.user = { sub, email: req.header(USER_EMAIL_HEADER) ?? "", role };
    next();
  };
}

// RBAC: dùng SAU authenticate/trustGatewayUser.
export function authorize(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(Unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(Forbidden("Bạn không có quyền truy cập tài nguyên này"));
    }
    next();
  };
}
