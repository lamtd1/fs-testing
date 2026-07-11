// DEAD-LETTER QUEUE (DLQ): nơi chứa job đã thất bại HẾT số lần thử.
// Vì sao cần? Để KHÔNG mất job hỏng. Ta có thể xem lại, cảnh báo, hoặc "replay"
// (đẩy ngược về queue chính) sau khi đã sửa nguyên nhân lỗi.
import { Queue } from "bullmq";
import { bullConnection } from "../../lib/queue.js";
import type { WelcomeEmailJob } from "./email.queue.js";

export const EMAIL_DLQ = "email-dead";

export const emailDeadQueue = new Queue<WelcomeEmailJob & { reason: string }>(EMAIL_DLQ, {
  connection: bullConnection,
});
