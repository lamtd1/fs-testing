// Entrypoint cho TIẾN TRÌNH WORKER (chạy tách khỏi API server).
//   Dev:  pnpm --filter @app/api worker
//   Prod: node dist/worker.js
// Đây là điểm mấu chốt của kiến trúc queue: API và Worker là HAI process khác
// nhau, chỉ chia sẻ Redis. Có thể deploy/scale/khởi động lại độc lập.
import { startEmailWorker } from "./queues/email/email.worker.js";
import { logger } from "./lib/logger.js";
import { bullConnection } from "./lib/queue.js";

const worker = startEmailWorker();

// Graceful shutdown: đóng worker gọn gàng để không bỏ dở job đang chạy.
async function shutdown(signal: string) {
  logger.info(`Worker nhận ${signal}, đang tắt…`);
  await worker.close();
  await bullConnection.quit();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
