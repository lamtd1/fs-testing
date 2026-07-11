// ============================================================================
//  SAGA (orchestration) — thay cho transaction khi ghi dữ liệu qua NHIỀU service.
// ----------------------------------------------------------------------------
//  Không có transaction xuyên DB nữa (mỗi service một DB). Nên: làm từng bước,
//  MỖI bước thành công thì ĐĂNG KÝ một hành động "bù trừ" (undo). Nếu bước sau
//  lỗi -> chạy các bù trừ theo THỨ TỰ NGƯỢC -> hệ thống quay về trạng thái sạch.
//  Đây là "eventual consistency": không nhất quán tức thời, nhưng tự dọn về đúng.
// ============================================================================
interface SagaLogger {
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

export class Saga {
  private compensations: Array<{ step: string; undo: () => Promise<void> }> = [];

  constructor(
    private readonly logger?: SagaLogger,
    private readonly name = "saga",
  ) {}

  // Gọi NGAY SAU khi một bước thành công: đăng ký cách hoàn tác bước đó.
  onCompensate(step: string, undo: () => Promise<void>): void {
    this.compensations.push({ step, undo });
  }

  // Khi có lỗi: chạy bù trừ ngược thứ tự. Bù trừ là best-effort — một cái lỗi
  // không được chặn các cái còn lại (ghi log để người vận hành xử lý tay).
  async compensate(): Promise<void> {
    for (const { step, undo } of [...this.compensations].reverse()) {
      try {
        await undo();
        this.logger?.warn({ saga: this.name, step }, "↩️  đã bù trừ bước");
      } catch (err) {
        this.logger?.error({ saga: this.name, step, err }, "bù trừ THẤT BẠI (cần xử lý tay)");
      }
    }
  }
}
