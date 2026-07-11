# Phần 5: Message Queue (BullMQ)

> Code: `code/apps/api/src/queues/` + `src/worker.ts`. Đi qua từng file, giải thích *vì sao*.
> Đã kiểm chứng chạy thật: đăng ký → API trả ngay (~0.1s) + worker gửi email nền; job lỗi retry 3 lần → dead-letter queue; idempotency (2 lần enqueue = 1 job). Bắt và sửa 1 bug thật (dấu `:` trong jobId).

Nếu bạn chưa từng đọc về message queue, hãy đọc phần "Message queue là gì / để làm gì" mình đã tóm tắt trước khi vào code. Tóm gọn: **queue tách việc chậm ra khỏi request HTTP**. Producer (API) thả job rồi trả lời user ngay; worker (tiến trình nền) làm việc nặng sau.

Ứng dụng trong app của ta: **gửi email chào mừng khi đăng ký**. Gửi email qua SMTP mất 1–3s — không nên bắt user chờ.

---

## 5.0 — Sơ đồ tổng thể

```
   POST /register
        │
        ▼
   ┌──────────┐   emailQueue.add()   ┌─────────────┐
   │   API    │ ───────────────────► │    Redis    │  (hàng đợi "email")
   │ (producer)│                     │  (BullMQ)   │
   └──────────┘ ◄─── trả 201 NGAY    └─────────────┘
                                            │  worker lấy job ra
                                            ▼
                                     ┌─────────────┐
                                     │   Worker    │  gửi email thật (SMTP)
                                     │ (tiến trình │  lỗi -> retry -> dead-letter
                                     │   RIÊNG)    │
                                     └─────────────┘
```

Điểm mấu chốt: **API và Worker là HAI process khác nhau**, chỉ chia sẻ Redis. Chạy:
```bash
pnpm --filter @app/api dev       # API (terminal 1)
pnpm --filter @app/api worker    # Worker (terminal 2)
```

Vì sao tách? (1) Việc nặng không ăn tài nguyên của process phục vụ HTTP. (2) **Scale độc lập**: cần gửi nhiều email hơn → chạy thêm process worker mà không đụng gì tới API.

---

## 5.1 — Kết nối BullMQ (`lib/queue.ts`): một cái bẫy cấu hình

```ts
export const bullConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
```

Vì sao lại một connection **riêng** cho BullMQ, khác `lib/redis.ts` (Phần 2)?

Worker BullMQ dùng lệnh Redis kiểu **blocking** (`BRPOPLPUSH`…): nó nằm chờ cho tới khi có job mới. ioredis mặc định (`maxRetriesPerRequest: 3`) sẽ **tự huỷ** một lệnh sau vài lần thử — làm hỏng lệnh blocking đó, và BullMQ sẽ báo lỗi/không chạy. Đặt `maxRetriesPerRequest: null` bảo ioredis "đừng bỏ cuộc, cứ chờ".

Nhưng với connection dùng cho cache/refresh-token (Phần 2) thì `maxRetriesPerRequest: 3` lại hợp lý (không muốn treo mãi). Hai nhu cầu trái nhau → hai connection.

---

## 5.2 — Producer (`email.queue.ts`): thả job

```ts
export const emailQueue = new Queue<WelcomeEmailJob>("email", {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,                                   // thử tối đa 3 lần
    backoff: { type: "exponential", delay: 1000 }, // chờ 1s, 2s, 4s giữa các lần
    removeOnComplete: 100,                         // giữ 100 job xong gần nhất
    removeOnFail: false,                           // GIỮ job hỏng để điều tra
  },
});
```

Giải thích các `defaultJobOptions` (áp cho mọi job):

- **`attempts: 3`** — nếu processor ném lỗi, BullMQ tự thử lại, tối đa 3 lần. Đây là "siêu năng lực" của queue: nhà cung cấp email chập chờn → tự phục hồi, không mất email.
- **`backoff: exponential, delay 1000`** — giữa các lần thử, chờ tăng dần (1s → 2s → 4s). Vì sao *tăng dần* chứ không thử lại ngay? Nếu dịch vụ đang quá tải, dồn dập thử lại chỉ làm nó tệ hơn. Chờ lâu dần cho nó thời gian hồi phục (đây là pattern chuẩn "exponential backoff").
- **`removeOnComplete: 100`** — giữ lịch sử 100 job thành công gần nhất để xem, cũ hơn thì xoá cho nhẹ Redis.
- **`removeOnFail: false`** — job hỏng **không xoá**, để ta điều tra và đẩy sang dead-letter.

Hàm thả job:

```ts
export function enqueueWelcomeEmail(data: WelcomeEmailJob) {
  return emailQueue.add("welcome", data, {
    jobId: `welcome-${data.userId}`,   // IDEMPOTENCY
  });
}
```

**`jobId` cố định theo user → idempotency.** Nếu vì lý do gì đó `enqueueWelcomeEmail` bị gọi 2 lần cho cùng user (double-submit, retry ở tầng khác…), BullMQ thấy `jobId` đã tồn tại → **không tạo job thứ hai** → không gửi email trùng. Đã kiểm chứng: 2 lần gọi → cùng `welcome-same-user-123`, queue chỉ có 1 job.

> ⚠️ **Bug thật đã bắt được khi verify:** lúc đầu mình viết `jobId: welcome:${userId}` (dấu hai chấm). BullMQ **cấm dấu `:`** trong jobId vì nó dùng `:` để đặt tên key trong Redis → lỗi *"Custom Id cannot contain :"*. Sửa thành dấu `-`. Nhờ đã bọc `try/catch` quanh enqueue (xem 5.4), việc đăng ký vẫn không bị hỏng khi lỗi này xảy ra.

---

## 5.3 — Consumer (`email.worker.ts`): làm việc thật + retry + DLQ

```ts
const worker = new Worker<WelcomeEmailJob>(
  "email",
  async (job) => {                         // processor: chạy cho MỖI job
    await sendWelcomeEmail(job.data);       // ném lỗi -> BullMQ tự retry
  },
  { connection: bullConnection, concurrency: 5 }, // 5 job song song / worker
);
```

- **`processor`** là hàm BullMQ gọi cho mỗi job. Quy ước quan trọng: **ném lỗi = job thất bại** → BullMQ tự lo retry theo `attempts`/`backoff`. Bạn không tự viết vòng lặp retry.
- **`concurrency: 5`** — một worker xử lý tối đa 5 job cùng lúc. Việc gửi email chủ yếu là *chờ mạng* (I/O), nên chạy song song vài job rất hiệu quả.

### Dead-letter queue (DLQ)

```ts
worker.on("failed", async (job, err) => {
  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsMade >= attempts) {              // đã thử hết số lần
    await emailDeadQueue.add("dead", { ...job.data, reason: err.message });
  }
});
```

Sự kiện `failed` bắn ra sau **mỗi** lần thử thất bại. Ta chỉ hành động khi `attemptsMade >= attempts` — tức job đã "chết hẳn" sau khi thử hết. Lúc đó đẩy nó sang **dead-letter queue** (`email-dead`) kèm lý do.

**Vì sao cần DLQ?** Để **không mất** job hỏng. Thay vì lặng lẽ biến mất, job nằm trong DLQ → ta xem lại được, cảnh báo (alert), hoặc sau khi sửa nguyên nhân thì "replay" (đẩy ngược về queue chính). Đây là lưới an toàn cuối cùng.

Kết quả kiểm chứng (đăng ký email bắt đầu bằng `fail`):
```
Job email thất bại   (lần 1)
Job email thất bại   (lần 2, sau ~1.3s)
Job email thất bại   (lần 3, sau ~2.4s)   ← thấy rõ backoff tăng dần
☠️  Đẩy job vào dead-letter queue
→ bull:email-dead:wait có 1 job
```

---

## 5.4 — Nối vào luồng đăng ký (`auth.service.ts`)

```ts
const user = await userRepository.createWithPassword({ ... });

try {
  await enqueueWelcomeEmail({ userId: user.id, email: user.email, name: user.name });
} catch (err) {
  logger.error({ err }, "Không enqueue được welcome email (bỏ qua)");
}

const accessToken = signAccessToken(user);
// ... trả về ngay, KHÔNG chờ email
```

Hai quyết định thiết kế:

1. **Chỉ `enqueue` (thả job) rồi đi tiếp** — không `await` việc gửi email thật. Đó là toàn bộ mục đích: user nhận `201` tức thì (đã đo: ~0.1s), email gửi nền. Đăng nhập lần đầu không phải chờ SMTP.

2. **Bọc `try/catch` quanh enqueue.** Email chào mừng là "có thì tốt", không phải bắt buộc. Nếu Redis/queue trục trặc, ta **không được** để việc đó làm hỏng đăng ký (một việc cốt lõi). Nên bắt lỗi, log lại, rồi vẫn cho đăng ký thành công. (Chính nhờ vậy mà bug dấu `:` ở trên không làm sập chức năng đăng ký khi verify.)

---

## 5.5 — Các đảm bảo & khái niệm cần nhớ

- **At-least-once delivery:** BullMQ đảm bảo job chạy *ít nhất một lần* (có thể hơn nếu worker chết giữa chừng và job được thử lại). Hệ quả: **processor nên idempotent** — chạy 2 lần không gây hại. Ví dụ nếu gửi email thì kiểm tra "đã gửi chưa"; nếu trừ tiền thì tuyệt đối phải idempotent (dùng khoá giao dịch).
- **Graceful shutdown** (`worker.ts`): khi nhận SIGTERM, gọi `worker.close()` để job đang chạy hoàn tất trước khi thoát — không bỏ dở giữa chừng (quan trọng khi deploy/restart trong Docker/k8s, Phần 8-9).
- **Quan sát queue:** trong thực tế nên gắn **Bull Board** (dashboard xem job wait/active/failed) — bài tập bên dưới.

---

## Bài tập tự làm

1. Thêm **Bull Board** (`@bull-board/express`) tại `/admin/queues` để xem job trực quan (nhớ bảo vệ bằng `authorize("ADMIN")`).
2. Viết một job **recurring** (lặp lịch) dùng `emailQueue.add` với `repeat: { pattern: "0 9 * * *" }` — gửi email tổng kết mỗi 9h sáng.
3. Thêm endpoint admin để **replay** một job từ DLQ về queue chính.
4. Làm `sendWelcomeEmail` gửi thật bằng **Nodemailer + MailHog** (một SMTP giả chạy Docker để xem email trong trình duyệt).

---

## Tiếp theo → Phần 6: Microservices

Giờ ta đã có building blocks (service tách tầng, queue, event). Phần 6 sẽ tách monolith thành nhiều service theo domain, cho chúng giao tiếp qua REST/message, và xử lý các vấn đề của hệ phân tán (saga, tracing, eventual consistency).
```
