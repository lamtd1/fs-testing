// ============================================================================
//  USER CLIENT — gọi LIÊN SERVICE sang user-service qua REST (fetch) cho GHI
//  (create/delete profile). ĐỌC profile giờ đi qua gRPC (user-grpc-client.ts).
// ----------------------------------------------------------------------------
//  6.3: truyền correlation-id (x-request-id) lấy từ AsyncLocalStorage -> log của
//  cả chuỗi auth→user cùng một id. 6.7 sẽ thêm timeout/retry/circuit breaker.
// ============================================================================
import { env } from "../config/env.js";
import { ServiceUnavailable, Conflict, REQUEST_ID_HEADER, getRequestId } from "@app/shared";

export interface Profile {
  id: string;
  email: string;
  name: string;
}

const BASE = `${env.USER_SERVICE_URL}/api/internal/users`;

// Gắn correlation-id (nếu đang trong một request) vào header gọi đi.
function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const rid = getRequestId();
  if (rid) h[REQUEST_ID_HEADER] = rid;
  return h;
}

export const userClient = {
  // Tạo profile ở user-service; nó tự sinh id và trả về.
  async createProfile(input: { email: string; name: string }): Promise<Profile> {
    let res: Response;
    try {
      res = await fetch(BASE, {
        method: "POST",
        headers: headers({ "content-type": "application/json" }),
        body: JSON.stringify(input),
      });
    } catch {
      throw ServiceUnavailable("Không gọi được user-service");
    }
    // Phân biệt lỗi: 409 (email đã tồn tại) là lỗi NGHIỆP VỤ -> Conflict, không
    // phải "service chết". Nhờ đó saga báo đúng 409 cho client thay vì 503.
    if (res.status === 409) throw Conflict("Email đã được sử dụng");
    if (!res.ok) throw ServiceUnavailable(`user-service trả lỗi ${res.status} khi tạo profile`);
    return (await res.json()) as Profile;
  },

  // Bù trừ saga: xoá profile vừa tạo nếu bước sau (tạo credential) thất bại.
  async deleteProfile(id: string): Promise<void> {
    try {
      await fetch(`${BASE}/${id}`, { method: "DELETE", headers: headers() });
    } catch {
      // nuốt lỗi — bù trừ best-effort; 6.4 làm chặt hơn.
    }
  },
};
