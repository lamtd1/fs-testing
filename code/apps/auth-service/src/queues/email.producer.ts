// PRODUCER: thả job "welcome email" vào queue. Consumer là notification-service.
// Hai bên chỉ chia sẻ Redis + contract (EMAIL_QUEUE, WelcomeEmailJob) từ @app/shared.
import { Queue } from "bullmq";
import { EMAIL_QUEUE, type WelcomeEmailJob } from "@app/shared";
import { bullConnection } from "../lib/queue.js";

export const emailQueue = new Queue<WelcomeEmailJob>(EMAIL_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});

export function enqueueWelcomeEmail(data: WelcomeEmailJob) {
  // jobId cố định theo user -> idempotency (không gửi trùng nếu enqueue 2 lần).
  return emailQueue.add("welcome", data, { jobId: `welcome-${data.userId}` });
}
