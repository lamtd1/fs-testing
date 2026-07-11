// ============================================================================
//  EMAIL WORKER — CONSUMER của queue "email". Nay là MỘT SERVICE RIÊNG.
// ----------------------------------------------------------------------------
//  So với Phần 5 (worker nằm trong monolith), giờ nó là service độc lập: chỉ
//  chia sẻ Redis + contract (EMAIL_QUEUE, WelcomeEmailJob) với auth-service.
//  auth-service KHÔNG biết notification-service tồn tại — chỉ phát event vào queue.
// ============================================================================
import { Worker, Queue, type Job } from "bullmq";
import { EMAIL_QUEUE, EMAIL_DLQ, type WelcomeEmailJob } from "@app/shared";
import { bullConnection } from "./lib/queue.js";
import { logger } from "./lib/logger.js";

const deadQueue = new Queue<WelcomeEmailJob & { reason: string }>(EMAIL_DLQ, {
  connection: bullConnection,
});

async function sendWelcomeEmail(data: WelcomeEmailJob) {
  await new Promise((r) => setTimeout(r, 300)); // giả lập SMTP
  if (data.email.startsWith("fail")) {
    throw new Error("SMTP provider từ chối (giả lập lỗi)");
  }
  logger.info({ to: data.email, name: data.name }, "📧 Đã gửi email chào mừng");
}

export function startEmailWorker() {
  const worker = new Worker<WelcomeEmailJob>(
    EMAIL_QUEUE,
    async (job: Job<WelcomeEmailJob>) => {
      logger.debug({ jobId: job.id, attempt: job.attemptsMade + 1 }, "Xử lý job email");
      await sendWelcomeEmail(job.data);
    },
    { connection: bullConnection, concurrency: 5 },
  );

  worker.on("completed", (job) => logger.info({ jobId: job.id }, "✅ Job hoàn thành"));

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    logger.warn(
      { jobId: job.id, attempt: job.attemptsMade, attempts, err: err.message },
      "Job email thất bại",
    );
    if (job.attemptsMade >= attempts) {
      await deadQueue.add("dead", { ...job.data, reason: err.message });
      logger.error({ jobId: job.id }, "☠️  Đẩy job vào dead-letter queue");
    }
  });

  logger.info("notification-service: email worker đang chạy…");
  return worker;
}
