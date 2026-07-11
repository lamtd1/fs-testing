// ============================================================================
//  EMAIL QUEUE — phía PRODUCER (thả job vào hàng đợi)
// ----------------------------------------------------------------------------
//  Queue chỉ là "ống dẫn". Ai đó (API) gọi enqueueWelcomeEmail() để bỏ job vào,
//  worker (email.worker.ts) sẽ lấy ra xử lý. Hai bên KHÔNG biết nhau, chỉ biết
//  cùng một tên queue ("email").
// ============================================================================
import { Queue } from "bullmq";
import { bullConnection } from "../../lib/queue.js";

export const EMAIL_QUEUE = "email";

// Kiểu dữ liệu của job -> producer và worker cùng import, không lệch nhau.
export interface WelcomeEmailJob {
  userId: string;
  email: string;
  name: string;
}

// defaultJobOptions áp cho MỌI job thêm vào queue này:
export const emailQueue = new Queue<WelcomeEmailJob>(EMAIL_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3, // thử tối đa 3 lần nếu lỗi
    backoff: { type: "exponential", delay: 1000 }, // chờ 1s, 2s, 4s giữa các lần
    removeOnComplete: 100, // giữ lại 100 job thành công gần nhất (để xem lịch sử)
    removeOnFail: false, // GIỮ job thất bại (đừng xoá) để điều tra / đẩy sang DLQ
  },
});

// Hàm để API gọi. Trả về job đã tạo.
export function enqueueWelcomeEmail(data: WelcomeEmailJob) {
  return emailQueue.add("welcome", data, {
    // jobId cố định theo user -> IDEMPOTENCY: gọi 2 lần (vd double-submit) cũng
    // chỉ tạo 1 job "welcome" cho user này -> không gửi email trùng.
    // LƯU Ý: BullMQ CẤM dấu ":" trong jobId (nó dùng ":" cho key Redis) -> dùng "-".
    jobId: `welcome-${data.userId}`,
  });
}
