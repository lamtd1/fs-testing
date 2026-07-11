// Seed CREDENTIAL. Dùng userId CỐ ĐỊNH khớp seed của user-service (qua @app/shared).
import { PrismaClient } from "../src/generated/prisma/index.js";
import argon2 from "argon2";
import { SEED_ADMIN_ID, SEED_USER_ID } from "@app/shared";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash("password123", { type: argon2.argon2id });

  await prisma.credential.upsert({
    where: { userId: SEED_ADMIN_ID },
    update: { email: "admin@example.com", passwordHash, role: "ADMIN" },
    create: { userId: SEED_ADMIN_ID, email: "admin@example.com", passwordHash, role: "ADMIN" },
  });
  await prisma.credential.upsert({
    where: { userId: SEED_USER_ID },
    update: { email: "user@example.com", passwordHash, role: "USER" },
    create: { userId: SEED_USER_ID, email: "user@example.com", passwordHash, role: "USER" },
  });
  console.log("✅ [auth-service] Seed credential xong. Login: admin@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
