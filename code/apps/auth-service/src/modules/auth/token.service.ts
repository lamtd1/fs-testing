// TOKEN SERVICE — cấp/xoay access & refresh token (xem giải thích chi tiết ở Phần 2).
// Access token: JWT ngắn hạn, stateless. Refresh token: dài hạn, lưu Redis để
// rotation + reuse detection + revoke.
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import ms from "ms";
import type { Role } from "../../generated/prisma/index.js";
import { Unauthorized } from "@app/shared";
import { env } from "../../config/env.js";
import { redis } from "../../lib/redis.js";
import { logger } from "../../lib/logger.js";

export interface AccessPayload {
  sub: string;
  email: string;
  role: Role;
}
interface RefreshPayload {
  sub: string;
  jti: string;
  family: string;
}

const refreshTtlSec = Math.floor(ms(env.REFRESH_TOKEN_TTL) / 1000);

export function signAccessToken(user: { userId: string; email: string; role: Role }): string {
  const payload: AccessPayload = { sub: user.userId, email: user.email, role: user.role };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
}

async function issue(userId: string, family: string): Promise<string> {
  const jti = randomUUID();
  const payload: RefreshPayload = { sub: userId, jti, family };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  } as jwt.SignOptions);
  await redis.set(`rt:${jti}`, family, "EX", refreshTtlSec);
  return token;
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const family = randomUUID();
  await redis.set(`rtfam:${family}`, "1", "EX", refreshTtlSec);
  return issue(userId, family);
}

async function revokeFamily(family: string): Promise<void> {
  await redis.del(`rtfam:${family}`);
}

function verifyRefresh(token: string): RefreshPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
  } catch {
    throw Unauthorized("Refresh token không hợp lệ hoặc đã hết hạn");
  }
}

export async function rotateRefreshToken(
  token: string,
): Promise<{ userId: string; newRefreshToken: string }> {
  const { sub: userId, jti, family } = verifyRefresh(token);

  const familyOk = await redis.exists(`rtfam:${family}`);
  if (!familyOk) throw Unauthorized("Phiên đã bị thu hồi");

  const stored = await redis.get(`rt:${jti}`);
  if (stored === null) {
    logger.warn({ userId, family }, "🚨 Refresh token reuse detected — revoking family");
    await revokeFamily(family);
    throw Unauthorized("Phát hiện tái sử dụng token — phiên đã bị thu hồi");
  }

  await redis.del(`rt:${jti}`);
  const newRefreshToken = await issue(userId, family);
  return { userId, newRefreshToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const { jti, family } = verifyRefresh(token);
    await redis.del(`rt:${jti}`);
    await revokeFamily(family);
  } catch {
    // token hỏng/hết hạn -> coi như đã logout.
  }
}
