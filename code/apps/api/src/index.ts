// Điểm khởi động (entrypoint): lắng nghe port + graceful shutdown.
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 API chạy tại http://localhost:${env.PORT}`);
  logger.info(`   Health: http://localhost:${env.PORT}/api/health`);
});

// Graceful shutdown: khi nhận SIGINT/SIGTERM -> đóng server + ngắt DB gọn gàng.
// Rất quan trọng khi chạy trong Docker/k8s để không rớt request đang xử lý.
async function shutdown(signal: string) {
  logger.info(`Nhận ${signal}, đang tắt...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Đã đóng server & DB. Bye 👋");
    process.exit(0);
  });
  // Ép thoát nếu quá 10s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
