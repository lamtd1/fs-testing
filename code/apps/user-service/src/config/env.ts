import "dotenv/config"; // nạp .env của CHÍNH service này (cwd)
// ENV của user-service. Chỉ validate đúng những gì service này cần.
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4002),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Cần để VERIFY access token cho route quản trị (authenticate + authorize ADMIN).
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET quá ngắn"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ [user-service] Biến môi trường không hợp lệ:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
