// Seed dữ liệu mẫu. Chạy: pnpm --filter @app/api prisma:seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", name: "Admin" },
  });
  await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: { email: "user@example.com", name: "Normal User" },
  });
  console.log("✅ Seed xong: admin@example.com, user@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
