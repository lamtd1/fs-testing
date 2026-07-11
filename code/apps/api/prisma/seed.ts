// Seed dữ liệu mẫu. Chạy: pnpm --filter @app/api prisma:seed
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash("password123", { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { role: "ADMIN", passwordHash },
    create: { email: "admin@example.com", name: "Admin", role: "ADMIN", passwordHash },
  });
  await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: { role: "USER", passwordHash },
    create: { email: "user@example.com", name: "Normal User", role: "USER", passwordHash },
  });
  console.log("✅ Seed xong. Login: admin@example.com / user@example.com — mật khẩu: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
