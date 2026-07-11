// Helper set/xoá refresh-token cookie. Tách riêng để CẢ login thường (Phần 2)
// LẪN OAuth callback (Phần 3) dùng chung một cấu hình cookie -> nhất quán.
import type { Response } from "express";
import ms from "ms";
import { env } from "../../config/env.js";

export const REFRESH_COOKIE = "refresh_token";

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true, // JS không đọc được -> chống XSS đánh cắp
    secure: env.NODE_ENV === "production", // chỉ gửi qua HTTPS ở production
    sameSite: "lax", // giảm CSRF, vẫn cho redirect OAuth hoạt động
    path: "/api/auth", // cookie chỉ gửi tới các route auth
    maxAge: ms(env.REFRESH_TOKEN_TTL),
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}
