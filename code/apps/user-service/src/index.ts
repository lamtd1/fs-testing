import "./tracing.js"; // PHẢI đầu tiên: bật OpenTelemetry trước khi load http/express
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { startGrpcServer } from "./grpc/server.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`🚀 user-service (HTTP) tại http://localhost:${env.PORT}`);
});

// Server gRPC nội bộ chạy song song với HTTP (6.3).
const grpcServer = startGrpcServer(env.GRPC_PORT);

async function shutdown(signal: string) {
  logger.info(`Nhận ${signal}, đang tắt user-service...`);
  grpcServer.forceShutdown();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
