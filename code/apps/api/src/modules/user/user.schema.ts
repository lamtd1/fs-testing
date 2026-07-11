// Zod schema cho module user — vừa validate, vừa suy ra TYPE (single source of truth).
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

// Suy ra type từ schema — không cần khai báo interface thủ công.
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
