// ============================================================================
//  KẾT NỐI BULLMQ
// ----------------------------------------------------------------------------
//  BullMQ dùng Redis làm nơi lưu hàng đợi. NHƯNG worker của BullMQ dùng lệnh
//  "blocking" (BRPOPLPUSH...) chờ job mới -> nó YÊU CẦU option
//     maxRetriesPerRequest: null
//  Nếu không, ioredis sẽ tự huỷ lệnh blocking sau vài lần thử và BullMQ báo lỗi.
//  Vì thế ta tạo một connection RIÊNG cho BullMQ, khác với redis.ts (dùng cho
//  cache/refresh-token — nơi maxRetriesPerRequest: 3 lại hợp lý).
// ============================================================================
import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const bullConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
