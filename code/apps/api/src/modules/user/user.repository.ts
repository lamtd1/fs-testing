// REPOSITORY: tầng duy nhất được nói chuyện trực tiếp với DB (Prisma).
// Lợi ích: nếu đổi ORM/DB sau này, chỉ sửa ở đây; service không đổi.
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { CreateUserInput } from "./user.schema.js";

// Các field AN TOÀN để trả ra ngoài. TUYỆT ĐỐI không đưa passwordHash vào response.
const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userRepository = {
  findMany(skip: number, take: number) {
    return prisma.$transaction([
      prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: publicUserSelect,
      }),
      prisma.user.count(),
    ]);
  },

  // findById dùng cho cả API user-management -> chỉ trả field public.
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  },

  // findByEmail dùng cho auth login -> CẦN passwordHash nên trả full record.
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  create(data: CreateUserInput) {
    return prisma.user.create({ data, select: publicUserSelect });
  },

  // Dùng cho đăng ký (auth module). Trả field public (đủ để ký access token).
  createWithPassword(data: { email: string; name: string; passwordHash: string }) {
    return prisma.user.create({ data, select: publicUserSelect });
  },

  update(id: string, data: { name?: string }) {
    return prisma.user.update({ where: { id }, data, select: publicUserSelect });
  },

  delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },
};
