// Truy cập DB cho OAuth. Chỉ trả field cần cho việc ký token (id, email, role).
import { prisma } from "../../../lib/prisma.js";

const userSelect = { id: true, email: true, name: true, role: true } as const;

export const oauthRepository = {
  // Tìm user đã liên kết với (provider, tài khoản bên đó).
  findUserByOAuthAccount(provider: string, providerAccountId: string) {
    return prisma.oAuthAccount
      .findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        select: { user: { select: userSelect } },
      })
      .then((row) => row?.user ?? null);
  },

  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, select: userSelect });
  },

  // Liên kết một tài khoản OAuth vào user đã tồn tại.
  async linkAccount(userId: string, provider: string, providerAccountId: string) {
    await prisma.oAuthAccount.create({ data: { userId, provider, providerAccountId } });
  },

  // Tạo user MỚI + tạo luôn liên kết OAuth trong 1 transaction (all-or-nothing).
  createUserWithAccount(data: {
    email: string;
    name: string;
    provider: string;
    providerAccountId: string;
  }) {
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        oauthAccounts: {
          create: { provider: data.provider, providerAccountId: data.providerAccountId },
        },
      },
      select: userSelect,
    });
  },
};
