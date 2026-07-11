// Một instance PrismaClient dùng chung toàn app (singleton).
// Ở dev với hot-reload (tsx watch), ta cache vào globalThis để tránh tạo
// nhiều connection mỗi lần reload -> cạn connection pool.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
