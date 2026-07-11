// ============================================================================
//  USER CLIENT (REST) — nay có RESILIENCE (6.7): timeout + retry + circuit breaker.
// ----------------------------------------------------------------------------
//  Ba lớp phòng thủ khi gọi mạng sang user-service:
//   1. TIMEOUT (AbortSignal): không chờ mãi — quá hạn coi như lỗi, giải phóng luồng.
//   2. RETRY (backoff): lỗi chớp nhoáng thì thử lại vài lần (chỉ cho thao tác hợp lý).
//   3. CIRCUIT BREAKER (opossum): user-service hỏng liên tục -> "mở mạch" -> fail
//      NHANH mà không dội request vào service đang chết; sau resetTimeout thử lại.
// ============================================================================
import CircuitBreaker from "opossum";
import {
  ServiceUnavailable,
  Conflict,
  REQUEST_ID_HEADER,
  getRequestId,
  serviceRegistry,
  withRetry,
} from "@app/shared";

export interface Profile {
  id: string;
  email: string;
  name: string;
}

const BASE = `${serviceRegistry.userHttp()}/api/internal/users`;
const TIMEOUT_MS = 3000;

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const rid = getRequestId();
  if (rid) h[REQUEST_ID_HEADER] = rid;
  return h;
}

// --- Một LẦN gọi tạo profile, có timeout riêng ---
async function attemptCreateProfile(input: { email: string; name: string }): Promise<Profile> {
  let res: Response;
  try {
    res = await fetch(BASE, {
      method: "POST",
      headers: headers({ "content-type": "application/json" }),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS), // (1) TIMEOUT
    });
  } catch {
    throw ServiceUnavailable("Không gọi được user-service (timeout/mạng)");
  }
  // 409 = email trùng: LỖI NGHIỆP VỤ, KHÔNG retry, KHÔNG tính vào circuit.
  if (res.status === 409) throw Conflict("Email đã được sử dụng");
  if (!res.ok) throw ServiceUnavailable(`user-service trả lỗi ${res.status} khi tạo profile`);
  return (await res.json()) as Profile;
}

// (3) CIRCUIT BREAKER bọc quanh mỗi lần gọi. Lỗi 409 (Conflict) KHÔNG nên làm
// "nhảy" circuit -> đánh dấu là lỗi mong đợi qua errorFilter.
const createBreaker = new CircuitBreaker(attemptCreateProfile, {
  timeout: TIMEOUT_MS + 500, // backstop; timeout thật do AbortSignal lo
  errorThresholdPercentage: 50,
  resetTimeout: 10_000,
  volumeThreshold: 3,
  errorFilter: (err: unknown) =>
    typeof err === "object" && err !== null && (err as { code?: string }).code === "CONFLICT",
});
createBreaker.fallback(() => {
  // Khi mạch MỞ (user-service coi như chết) -> fail nhanh, không chờ.
  throw ServiceUnavailable("user-service tạm thời không khả dụng (circuit open)");
});

export const userClient = {
  // (2) RETRY quanh breaker: lỗi transient thử lại; 409 thì dừng ngay.
  createProfile(input: { email: string; name: string }): Promise<Profile> {
    return withRetry(() => createBreaker.fire(input) as Promise<Profile>, {
      retries: 2,
      baseDelayMs: 200,
      shouldRetry: (err) =>
        !(typeof err === "object" && err !== null && (err as { code?: string }).code === "CONFLICT"),
    });
  },

  // Bù trừ saga: best-effort, chỉ cần timeout (không retry/breaker cho gọn).
  async deleteProfile(id: string): Promise<void> {
    try {
      await fetch(`${BASE}/${id}`, {
        method: "DELETE",
        headers: headers(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // nuốt lỗi — bù trừ best-effort.
    }
  },
};
