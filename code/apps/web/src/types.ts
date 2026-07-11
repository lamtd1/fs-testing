// Kiểu dữ liệu dùng chung ở frontend. Khớp với response của backend.
// (Ở Phần sau có thể sinh tự động từ backend qua OpenAPI/Zod chia sẻ.)
export type Role = "USER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt?: string;
  updatedAt?: string;
}
