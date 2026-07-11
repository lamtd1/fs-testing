import "dotenv/config"; // nạp .env của CHÍNH service này (cwd)
// ENV của API Gateway.
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  AUTH_SERVICE_URL: z.string().url().default("http://localhost:4001"),
  USER_SERVICE_URL: z.string().url().default("http://localhost:4002"),

  // Verify JWT tại gateway (7.3) — phải TRÙNG secret mà auth-service ký.
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET quá ngắn"),
  // Secret dùng chung để service tin header do gateway gắn (7.3).
  GATEWAY_SECRET: z.string().min(8, "GATEWAY_SECRET quá ngắn"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ [gateway] Biến môi trường không hợp lệ:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
