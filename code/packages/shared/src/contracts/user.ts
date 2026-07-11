// CONTRACT của domain "user" — dùng chung giữa user-service, auth-service và FE.
// Đây chính là lợi ích monorepo: một schema, mọi bên cùng import -> không lệch nhau.
import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được rỗng").max(100),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().cuid("id không hợp lệ"),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// Hình dạng user trả ra ngoài (không có field nhạy cảm).
export interface UserDTO {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ID cố định cho dữ liệu seed -> auth-service và user-service seed CÙNG một userId,
// nhờ đó tài khoản seed đăng nhập được (credential ↔ profile khớp id).
export const SEED_ADMIN_ID = "cseedadmin000000000000000";
export const SEED_USER_ID = "cseeduser0000000000000000";
