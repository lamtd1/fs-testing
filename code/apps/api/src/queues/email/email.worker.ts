// ============================================================================
//  EMAIL WORKER — phía CONSUMER (lấy job ra và làm việc thật)
// ----------------------------------------------------------------------------
//  Worker CHẠY Ở TIẾN TRÌNH RIÊNG (xem src/worker.ts), tách khỏi API. Nhờ vậy:
//   - Việc nặng không ăn CPU/bộ nhớ của tiến trình phục vụ HTTP.
//   - Scale độc lập: cần gửi nhiều mail -> chạy thêm nhiều worker, không đụng API.
// ============================================================================
import { Worker, type Job } from "bullmq";
import { bullConnection } from "../../lib/queue.js";
import { logger } from "../../lib/logger.js";
import { EMAIL_QUEUE, type WelcomeEmailJob } from "./email.queue.js";
import { emailDeadQueue } from "./email.deadletter.js";

// Hàm "gửi email" thật sẽ nằm ở đây (Nodemailer/Resend/SES...). Ở tutorial ta
// GIẢ LẬP: log ra + delay. Nếu email bắt đầu bằng "fail@" thì cố tình ném lỗi
// để minh hoạ retry + dead-letter.
async function sendWelcomeEmail(data: WelcomeEmailJob) {
  await new Promise((r) => setTimeout(r, 300)); // giả lập gọi SMTP chậm
  // Demo: email bắt đầu bằng "fail" -> cố tình lỗi để minh hoạ retry + DLQ.
  if (data.email.startsWith("fail")) {
    throw new Error("SMTP provider từ chối (giả lập lỗi)");
  }
  logger.info({ to: data.email, name: data.name }, "📧 Đã gửi email chào mừng");
}

export function startEmailWorker() {
  const worker = new Worker<WelcomeEmailJob>(
    EMAIL_QUEUE,
    // processor: BullMQ gọi hàm này cho MỖI job. Ném lỗi -> BullMQ tự retry
    // theo cấu hình attempts/backoff đã đặt ở email.queue.ts.
    async (job: Job<WelcomeEmailJob>) => {
      logger.debug({ jobId: job.id, attempt: job.attemptsMade + 1 }, "Xử lý job email");
      await sendWelcomeEmail(job.data);
    },
    {
      connection: bullConnection,
      concurrency: 5, // xử lý tối đa 5 job song song trong 1 worker
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "✅ Job hoàn thành");
  });

  // 'failed' bắn ra sau MỖI lần thử thất bại. Chỉ khi đã hết số lần thử
  // (attemptsMade >= attempts) mới coi là "chết hẳn" -> đẩy sang DLQ.
  worker.on("failed", async (job, err) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    logger.warn(
      { jobId: job.id, attempt: job.attemptsMade, attempts, err: err.message },
      "Job email thất bại",
    );
    if (job.attemptsMade >= attempts) {
      // Hết cứu -> lưu vào dead-letter kèm lý do, để điều tra sau.
      await emailDeadQueue.add("dead", { ...job.data, reason: err.message });
      logger.error({ jobId: job.id }, "☠️  Đẩy job vào dead-letter queue");
    }
  });

  logger.info("Email worker đang chạy…");
  return worker;
}
