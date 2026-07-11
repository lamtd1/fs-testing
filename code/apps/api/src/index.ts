import "./tracing.js"; // PHẢI đầu tiên: bật OpenTelemetry trước khi load http/express
import { createApp, logger } from "./app.js";
import { env } from "./config/env.js";
import { serviceRegistry } from "@app/shared";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`🚪 API Gateway tại http://localhost:${env.PORT}`);
  logger.info(`   /api/auth  → ${serviceRegistry.authHttp()}`);
  logger.info(`   /api/users → ${serviceRegistry.userHttp()} (cần đăng nhập)`);
});
