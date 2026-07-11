// API Gateway — pipeline: CORS → correlation-id → strip → verify JWT → route.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { createLogger, requestId, notFoundHandler, serviceRegistry } from "@app/shared";
import { env } from "./config/env.js";
import { serviceProxy } from "./proxy.js";
import { stripSpoofedHeaders, attachUser, requireAuth } from "./middleware/gateway-auth.js";
import { generalLimiter, authLimiter } from "./middleware/rate-limit.js";
import { bffRoutes } from "./bff/bff.routes.js";

export const logger = createLogger({ name: "gateway", nodeEnv: env.NODE_ENV });

const AUTH_TARGET = serviceRegistry.authHttp();
const USER_TARGET = serviceRegistry.userHttp();

export function createApp() {
  const app = express();

  app.use(helmet());
  // (7.4) CORS TẬP TRUNG ở gateway — service nội bộ không cần cấu hình CORS nữa.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  // KHÔNG express.json() — để body stream nguyên vẹn cho proxy (service tự parse).
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as unknown as { id: string }).id }));

  // (7.4) Transform nhẹ: đánh dấu response đi qua gateway (che bớt chi tiết nội bộ).
  app.use((_req, res, next) => {
    res.setHeader("x-gateway", "fs-gateway");
    next();
  });

  // Health của chính gateway (cho Docker healthcheck) — không proxy đi đâu.
  app.get("/healthz", (_req, res) => res.json({ status: "ok", service: "gateway" }));

  // (7.4) Rate limit CHUNG cho mọi /api; giới hạn CHẶT riêng cho login/register.
  app.use("/api", generalLimiter);
  app.use(["/api/auth/login", "/api/auth/register"], authLimiter);

  // (7.3) Chống giả mạo header + verify JWT một lần -> req.user.
  app.use(stripSpoofedHeaders);
  app.use(attachUser);

  // (7.5) BFF: gateway TỰ gộp nhiều service (cần đăng nhập). Đặt TRƯỚC proxy để
  // /api/bff không bị chuyển tiếp đi đâu — nó do CHÍNH gateway xử lý.
  app.use("/api/bff", requireAuth, bffRoutes);

  // Route BẮT BUỘC đăng nhập (guard chạy TRƯỚC proxy tương ứng).
  app.use("/api/users", requireAuth); // quản trị user
  app.use("/api/auth/me", requireAuth); // hồ sơ của chính mình

  // Routing / proxy (giữ nguyên path, inject context xuống service).
  app.use("/api/auth", serviceProxy(AUTH_TARGET, "/api/auth"));
  app.use("/api/users", serviceProxy(USER_TARGET, "/api/users"));

  app.use(notFoundHandler);
  return app;
}
