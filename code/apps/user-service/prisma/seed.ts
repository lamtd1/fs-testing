// Seed PROFILE. Dùng id CỐ ĐỊNH khớp với seed của auth-service (qua @app/shared)
// -> tài khoản seed có cả profile lẫn credential cùng userId -> đăng nhập được.
import { PrismaClient } from "../src/generated/prisma/index.js";
import { SEED_ADMIN_ID, SEED_USER_ID } from "@app/shared";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { id: SEED_ADMIN_ID },
    update: { email: "admin@example.com", name: "Admin" },
    create: { id: SEED_ADMIN_ID, email: "admin@example.com", name: "Admin" },
  });
  await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: { email: "user@example.com", name: "Normal User" },
    create: { id: SEED_USER_ID, email: "user@example.com", name: "Normal User" },
  });
  console.log("✅ [user-service] Seed profile xong.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
