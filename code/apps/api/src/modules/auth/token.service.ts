// ============================================================================
//  TOKEN SERVICE — trái tim của hệ thống auth
// ============================================================================
//  Ý tưởng:
//   - ACCESS TOKEN: JWT ngắn hạn (15m). Client gửi kèm mỗi request (header
//     Authorization). Server chỉ cần verify chữ ký -> KHÔNG cần hỏi DB/Redis
//     => stateless, nhanh. Nhược điểm: không thu hồi ngay được -> nên để ngắn.
//
//   - REFRESH TOKEN: JWT dài hạn (7d), lưu trong httpOnly cookie. Dùng để xin
//     access token mới. Ta lưu trạng thái của nó trong Redis để có thể THU HỒI.
//
//  ROTATION: mỗi lần refresh -> cấp refresh token MỚI, huỷ token cũ. Nếu token
//  cũ bị dùng lại (REUSE) => dấu hiệu bị đánh cắp => thu hồi cả "family" (toàn
//  bộ phiên đăng nhập đó). Đây là chuẩn "Refresh Token Rotation" của OAuth.
//
//  Redis keys:
//   rtfam:{family}  = "1"      -> family còn hiệu lực   (TTL = refresh TTL)
//   rt:{jti}        = {family} -> token cụ thể chưa dùng (TTL = refresh TTL)
// ============================================================================
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import ms from "ms";
import { env } from "../../config/env.js";
import { redis } from "../../lib/redis.js";
import { logger } from "../../lib/logger.js";
import { Unauthorized } from "../../utils/errors.js";
import type { Role } from "@prisma/client";

// --- Payload types ---
export interface AccessPayload {
  sub: string; // userId
  email: string;
  role: Role;
}
interface RefreshPayload {
  sub: string; // userId
  jti: string; // id duy nhất của token này
  family: string; // id phiên đăng nhập
}

const refreshTtlSec = Math.floor(ms(env.REFRESH_TOKEN_TTL) / 1000);

// ---------- ACCESS TOKEN ----------
export function signAccessToken(user: {
  id: string;
  email: string;
  role: Role;
}): string {
  const payload: AccessPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  } catch {
    throw Unauthorized("Access token không hợp lệ hoặc đã hết hạn");
  }
}

// ---------- REFRESH TOKEN ----------
// Cấp refresh token cho một family. Nếu không truyền family -> tạo phiên mới.
async function issue(userId: string, family: string): Promise<string> {
  const jti = randomUUID();
  const payload: RefreshPayload = { sub: userId, jti, family };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  } as jwt.SignOptions);

  // Đánh dấu token này hợp lệ trong Redis (chưa bị dùng/xoay).
  await redis.set(`rt:${jti}`, family, "EX", refreshTtlSec);
  return token;
}

// Đăng nhập -> mở một phiên mới.
export async function issueRefreshToken(userId: string): Promise<string> {
  const family = randomUUID();
  await redis.set(`rtfam:${family}`, "1", "EX", refreshTtlSec);
  return issue(userId, family);
}

// Thu hồi cả phiên (family): dùng khi phát hiện reuse hoặc logout-all.
async function revokeFamily(family: string): Promise<void> {
  await redis.del(`rtfam:${family}`);
  // Các key rt:{jti} còn lại sẽ tự hết hạn theo TTL; và dù còn, family đã
  // bị xoá nên mọi lần refresh sau đều bị chặn.
}

function verifyRefresh(token: string): RefreshPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
  } catch {
    throw Unauthorized("Refresh token không hợp lệ hoặc đã hết hạn");
  }
}

// Xoay refresh token: trả về { userId, newRefreshToken }.
export async function rotateRefreshToken(
  token: string,
): Promise<{ userId: string; newRefreshToken: string }> {
  const { sub: userId, jti, family } = verifyRefresh(token);

  // 1) Family còn hiệu lực không?
  const familyOk = await redis.exists(`rtfam:${family}`);
  if (!familyOk) throw Unauthorized("Phiên đã bị thu hồi");

  // 2) Token cụ thể này còn "chưa dùng" không?
  const stored = await redis.get(`rt:${jti}`);
  if (stored === null) {
    // REUSE DETECTED: jti này đã bị xoay đi rồi mà vẫn có người dùng lại
    // => nghi bị đánh cắp => thu hồi toàn bộ phiên.
    logger.warn({ userId, family }, "🚨 Refresh token reuse detected — revoking family");
    await revokeFamily(family);
    throw Unauthorized("Phát hiện tái sử dụng token — phiên đã bị thu hồi");
  }

  // 3) Hợp lệ -> huỷ token cũ, cấp token mới CÙNG family (rotation).
  await redis.del(`rt:${jti}`);
  const newRefreshToken = await issue(userId, family);
  return { userId, newRefreshToken };
}

// Logout: huỷ token hiện tại + cả family.
export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const { jti, family } = verifyRefresh(token);
    await redis.del(`rt:${jti}`);
    await revokeFamily(family);
  } catch {
    // Token đã hỏng/hết hạn thì coi như đã logout.
  }
}
