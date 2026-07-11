// Connection RIÊNG cho BullMQ (maxRetriesPerRequest: null) — auth-service là
// PRODUCER, chỉ thả job "welcome email" vào queue; notification-service tiêu thụ.
import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const bullConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
