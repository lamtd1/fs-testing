// Redis client dùng chung (ioredis). Ở Phần 2 dùng để lưu refresh token
// (rotation + reuse detection). Về sau: rate limiting, cache, session, queue.
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => logger.error({ err }, "Redis error"));
redis.on("connect", () => logger.info("✅ Redis connected"));
