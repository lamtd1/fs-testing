// ============================================================================
//  RETRY với exponential backoff + jitter — cho lỗi TẠM THỜI (mạng chớp nhoáng).
// ----------------------------------------------------------------------------
//  CẢNH BÁO: chỉ retry thao tác IDEMPOTENT hoặc lỗi rõ ràng là transient. Retry
//  mù một thao tác ghi có thể gây trùng. `shouldRetry` để caller tự quyết.
// ============================================================================
export interface RetryOptions {
  retries?: number; // số lần thử LẠI (không tính lần đầu)
  baseDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 200;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !shouldRetry(err)) break;
      // backoff: base * 2^attempt + jitter ngẫu nhiên (tránh "thundering herd").
      const delay = base * 2 ** attempt + Math.floor(Math.random() * base);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
