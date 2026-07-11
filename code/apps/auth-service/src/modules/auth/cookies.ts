// Helper set/xoá refresh-token cookie (httpOnly).
import type { Response } from "express";
import ms from "ms";
import { env } from "../../config/env.js";

export const REFRESH_COOKIE = "refresh_token";

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: ms(env.REFRESH_TOKEN_TTL),
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}
