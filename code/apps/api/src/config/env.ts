// Đọc và VALIDATE biến môi trường bằng Zod ngay khi app khởi động.
// Nếu thiếu/sai biến -> app crash ngay với thông báo rõ ràng, thay vì lỗi mơ hồ lúc runtime.
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // Auth (Phần 2). Bắt buộc, tối thiểu 16 ký tự.
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET quá ngắn"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET quá ngắn"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // In lỗi đẹp rồi thoát — fail fast.
  console.error("❌ Biến môi trường không hợp lệ:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
