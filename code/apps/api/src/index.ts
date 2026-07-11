// ============================================================================
//  GATEWAY-LITE (tạm cho Phần 6) — một cửa vào duy nhất :4000 cho frontend.
// ----------------------------------------------------------------------------
//  Nhiệm vụ ở đây RẤT MỎNG: nhận request /api/* từ FE và CHUYỂN TIẾP (proxy)
//  tới đúng service. Nhờ vậy FE (Phần 4) không phải đổi gì — vẫn gọi :4000.
//
//  KHÔNG có auth/verify JWT tại đây (mỗi service tự verify). Việc "verify tập
//  trung tại gateway rồi truyền context xuống" là nội dung PHẦN 7 (API Gateway
//  thật: Kong/Traefik/KrakenD hoặc BFF). apps/api này sẽ được thay ở đó.
//
//  Ta CHỈ expose /api/auth và /api/users. Endpoint nội bộ /api/internal/* của
//  user-service KHÔNG được proxy ra ngoài — nó chỉ dành cho gọi giữa service.
// ============================================================================
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createLogger, requestId, notFoundHandler, serviceRegistry } from "@app/shared";
import { env } from "./config/env.js";

const logger = createLogger({ name: "gateway", nodeEnv: env.NODE_ENV });

// 6.5: gateway hỏi registry địa chỉ service đích (thay cho env riêng lẻ).
const AUTH_TARGET = serviceRegistry.authHttp();
const USER_TARGET = serviceRegistry.userHttp();
const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
// LƯU Ý: KHÔNG dùng express.json() ở gateway — để nguyên body cho proxy chuyển
// tiếp (parse ở service đích). Chỉ gán correlation-id rồi log.
app.use(requestId);
app.use(pinoHttp({ logger, genReqId: (req) => (req as unknown as { id: string }).id }));

// Proxy theo prefix, GIỮ NGUYÊN path (service cũng mount ở /api/...).
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: AUTH_TARGET,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/auth/" },
  }),
);
app.use(
  "/api/users",
  createProxyMiddleware({
    target: USER_TARGET,
    changeOrigin: true,
    pathRewrite: { "^/": "/api/users/" },
  }),
);

app.use(notFoundHandler);

app.listen(env.PORT, () => {
  logger.info(`🚪 gateway chạy tại http://localhost:${env.PORT}`);
  logger.info(`   /api/auth  → ${AUTH_TARGET}`);
  logger.info(`   /api/users → ${USER_TARGET}`);
});
