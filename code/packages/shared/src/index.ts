// Điểm export duy nhất của @app/shared. Các service import từ "@app/shared".
import "./express.js"; // nạp khai báo type toàn cục cho Express.Request

export * from "./errors.js";
export * from "./async-handler.js";
export * from "./logger.js";
export * from "./validate.js";
export * from "./http.js";
export * from "./context.js";
export * from "./grpc.js";
export * from "./auth.js";
export * from "./contracts/user.js";
export * from "./contracts/auth.js";
export * from "./contracts/events.js";
