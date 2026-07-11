// REPOSITORY: tầng duy nhất chạm DB app_auth (bảng credentials).
import { prisma } from "../../lib/prisma.js";

export const credentialRepository = {
  findByEmail(email: string) {
    return prisma.credential.findUnique({ where: { email } });
  },

  findById(userId: string) {
    return prisma.credential.findUnique({ where: { userId } });
  },

  create(data: { userId: string; email: string; passwordHash: string }) {
    return prisma.credential.create({ data });
  },

  deleteById(userId: string) {
    return prisma.credential.delete({ where: { userId } });
  },
};
