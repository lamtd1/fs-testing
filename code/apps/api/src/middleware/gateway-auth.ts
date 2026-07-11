// ============================================================================
//  AUTH TẠI GATEWAY (7.3) — verify JWT MỘT LẦN, truyền danh tính xuống service.
// ============================================================================
import type { Request, Response, NextFunction } from "express";
import {
  verifyAccessToken,
  Unauthorized,
  USER_ID_HEADER,
  USER_EMAIL_HEADER,
  USER_ROLE_HEADER,
  GATEWAY_TOKEN_HEADER,
} from "@app/shared";
import { env } from "../config/env.js";

// (a) CHỐNG GIẢ MẠO: client KHÔNG được tự gắn x-user-*/x-gateway-token. Xoá sạch
// header này ở đầu vào -> chỉ gateway mới được đặt chúng.
export function stripSpoofedHeaders(req: Request, _res: Response, next: NextFunction) {
  delete req.headers[USER_ID_HEADER];
  delete req.headers[USER_EMAIL_HEADER];
  delete req.headers[USER_ROLE_HEADER];
  delete req.headers[GATEWAY_TOKEN_HEADER];
  next();
}

// (b) Nếu có Bearer token -> verify, gắn req.user. Không có/không hợp lệ thì bỏ qua
// (route công khai vẫn chạy). Việc BẮT BUỘC đăng nhập để cho requireAuth lo.
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyAccessToken(header.slice("Bearer ".length), env.JWT_ACCESS_SECRET);
    } catch {
      // token hỏng -> coi như chưa đăng nhập; requireAuth sẽ chặn nếu route cần.
    }
  }
  next();
}

// (c) Guard cho route bắt buộc đăng nhập.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(Unauthorized("Cần đăng nhập"));
  next();
}
