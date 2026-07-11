// Logger dùng pino: nhanh, structured (JSON) — hợp cho production/log tập trung.
// Ở dev thì dùng pino-pretty cho dễ đọc.
import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
