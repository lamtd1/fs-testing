// Middleware xác thực: đọc access token từ header "Authorization: Bearer <token>",
// verify, rồi gán thông tin user vào req.user cho các handler sau dùng.
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type AccessPayload } from "../modules/auth/token.service.js";
import { Unauthorized } from "../utils/errors.js";

// Mở rộng type của Express để có req.user (typed).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next(Unauthorized("Thiếu access token"));
  }
  const token = header.slice("Bearer ".length);
  req.user = verifyAccessToken(token); // ném Unauthorized nếu sai/hết hạn
  next();
}
