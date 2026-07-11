// DB cho OAuth (bảng oauth_accounts + credentials, đều trong app_auth).
import { prisma } from "../../../lib/prisma.js";

const credSelect = { userId: true, email: true, role: true } as const;

export const oauthRepository = {
  // credential đã liên kết với (provider, sub)?
  async findCredentialByOAuthAccount(provider: string, providerAccountId: string) {
    const row = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      select: { credential: { select: credSelect } },
    });
    return row?.credential ?? null;
  },

  findCredentialByEmail(email: string) {
    return prisma.credential.findUnique({ where: { email }, select: credSelect });
  },

  async linkAccount(userId: string, provider: string, providerAccountId: string) {
    await prisma.oAuthAccount.create({ data: { userId, provider, providerAccountId } });
  },

  // Tạo credential (KHÔNG mật khẩu) + liên kết OAuth trong 1 transaction.
  createCredentialWithAccount(data: {
    userId: string;
    email: string;
    provider: string;
    providerAccountId: string;
  }) {
    return prisma.credential.create({
      data: {
        userId: data.userId,
        email: data.email,
        oauthAccounts: {
          create: { provider: data.provider, providerAccountId: data.providerAccountId },
        },
      },
      select: credSelect,
    });
  },
};
