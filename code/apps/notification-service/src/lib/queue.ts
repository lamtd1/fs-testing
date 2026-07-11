import { Redis } from "ioredis";
import { env } from "../config/env.js";

// BullMQ worker dùng lệnh blocking -> BẮT BUỘC maxRetriesPerRequest: null.
export const bullConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
