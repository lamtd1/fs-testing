// Zod schema cho FORM ở frontend. Nhờ vậy validate ngay trên trình duyệt
// (trải nghiệm tốt) — nhưng backend VẪN validate lại (không tin client).
// Đây gần như bản sao của schema backend; Phần sau ta có thể share chung.
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Nhập mật khẩu"),
});

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Nhập tên"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
