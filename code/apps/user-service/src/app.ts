import express from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { requestId, notFoundHandler, createErrorHandler } from "@app/shared";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { userRoutes } from "./modules/user/user.routes.js";
import { internalUserRoutes } from "./modules/user/internal.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as unknown as { id: string }).id }));

  app.use("/api", healthRoutes);
  app.use("/api/users", userRoutes); // public (qua gateway) — cần ADMIN
  app.use("/api/internal/users", internalUserRoutes); // service-to-service

  app.use(notFoundHandler);
  app.use(createErrorHandler({ nodeEnv: env.NODE_ENV, logger }));

  return app;
}
