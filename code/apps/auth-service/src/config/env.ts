import "dotenv/config"; // nạp .env của CHÍNH service này (cwd)
// ENV của auth-service.
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4001),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET quá ngắn"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET quá ngắn"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Địa chỉ user-service để gọi liên service (tạo/đọc profile).
  USER_SERVICE_URL: z.string().url().default("http://localhost:4002"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ [auth-service] Biến môi trường không hợp lệ:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
