// REPOSITORY: tầng duy nhất chạm DB app_user.
import { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateUserInput } from "@app/shared";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userRepository = {
  findMany(skip: number, take: number) {
    return prisma.$transaction([
      prisma.user.findMany({ skip, take, orderBy: { createdAt: "desc" }, select: publicUserSelect }),
      prisma.user.count(),
    ]);
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, select: publicUserSelect });
  },

  // Tạo profile. Cho phép truyền id (khi auth-service đã có userId) hoặc để trống
  // (admin tạo trực tiếp -> Prisma tự sinh cuid).
  create(data: CreateUserInput & { id?: string }) {
    return prisma.user.create({ data, select: publicUserSelect });
  },

  update(id: string, data: { name?: string }) {
    return prisma.user.update({ where: { id }, data, select: publicUserSelect });
  },

  delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },
};
