import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 auth-service chạy tại http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`Nhận ${signal}, đang tắt auth-service...`);
  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
