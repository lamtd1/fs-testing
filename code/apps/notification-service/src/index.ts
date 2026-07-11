import "./tracing.js"; // PHẢI đầu tiên: bật OpenTelemetry trước khi load http/express
// Entrypoint notification-service: khởi động email worker + graceful shutdown.
import { startEmailWorker } from "./email.worker.js";
import { bullConnection } from "./lib/queue.js";
import { logger } from "./lib/logger.js";

const worker = startEmailWorker();

async function shutdown(signal: string) {
  logger.info(`Nhận ${signal}, đang tắt notification-service…`);
  await worker.close();
  await bullConnection.quit();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
