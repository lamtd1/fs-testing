// CONTRACT của domain "auth" — dùng chung giữa auth-service và FE.
import { z } from "zod";
import type { Role } from "../auth.js";

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(72, "Mật khẩu tối đa 72 ký tự"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// User trả về cho FE sau login/register/me.
export interface AuthUserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
}
