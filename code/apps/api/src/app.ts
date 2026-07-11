// Tạo Express app: ráp middleware toàn cục + mount route + error handler.
// Tách khỏi index.ts để sau này dễ viết test (import app mà không cần listen port).
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { requestId } from "./middleware/requestId.js";
import { authenticate } from "./middleware/authenticate.js";
import { authorize } from "./middleware/authorize.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { userRoutes } from "./modules/user/user.routes.js";

export function createApp() {
  const app = express();

  // --- Middleware toàn cục (thứ tự QUAN TRỌNG) ---
  app.use(helmet()); // set các header bảo mật
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json()); // parse JSON body
  app.use(cookieParser()); // parse cookie -> req.cookies (cho refresh token)
  app.use(requestId); // gán req.id
  app.use(pinoHttp({ logger, genReqId: (req) => (req as unknown as { id: string }).id })); // log mỗi request

  // --- Routes ---
  app.use("/api", healthRoutes);
  app.use("/api/auth", authRoutes);
  // Quản lý user là API quản trị: phải đăng nhập (authenticate) VÀ là ADMIN (authorize).
  app.use("/api/users", authenticate, authorize("ADMIN"), userRoutes);

  // --- 404 + Error handler (LUÔN đặt cuối cùng) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
