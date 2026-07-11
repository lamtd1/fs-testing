// ============================================================================
//  RATE LIMITING (7.4) — chặn abuse/brute-force NGAY Ở BIÊN, trước khi chạm service.
// ----------------------------------------------------------------------------
//  Lưu bộ đếm trong REDIS (không phải bộ nhớ) -> khi chạy NHIỀU gateway, giới hạn
//  vẫn đúng tổng thể (mọi instance chia sẻ cùng bộ đếm).
// ============================================================================
import rateLimit from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

function redisStore(prefix: string) {
  return new RedisStore({
    prefix,
    // Cầu nối ioredis cho rate-limit-redis.
    sendCommand: (...args: string[]) =>
      redis.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
  });
}

// Giới hạn CHUNG: 300 request / phút / IP cho toàn bộ /api.
export const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: redisStore("rl:gen:"),
  message: { error: { code: "RATE_LIMITED", message: "Quá nhiều request, thử lại sau." } },
});

// Giới hạn CHẶT cho auth (chống brute-force mật khẩu): 10 lần / 15 phút / IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: redisStore("rl:auth:"),
  message: {
    error: { code: "RATE_LIMITED", message: "Quá nhiều lần thử đăng nhập, thử lại sau 15 phút." },
  },
});
