// Factory tạo logger pino cho từng service. Mỗi service truyền `name` riêng
// -> log của service nào cũng tự đính kèm tên đó (dễ lọc khi log tập trung).
import pino from "pino";

export function createLogger(opts: { name: string; nodeEnv: string }) {
  return pino({
    name: opts.name,
    level: opts.nodeEnv === "production" ? "info" : "debug",
    transport:
      opts.nodeEnv === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
