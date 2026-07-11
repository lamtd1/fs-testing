// Khởi động tracing TRƯỚC mọi import khác. Xem @app/shared/tracing.
import "dotenv/config";
import { startTracing } from "@app/shared/tracing";

startTracing("notification-service");
