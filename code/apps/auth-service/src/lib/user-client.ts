// ============================================================================
//  USER CLIENT — gọi LIÊN SERVICE sang user-service qua REST (fetch).
// ----------------------------------------------------------------------------
//  Đây là bản NGÂY THƠ (naive): chưa truyền correlation-id, chưa retry/timeout,
//  chưa circuit breaker. 6.3 sẽ thay bằng client tử tế (truyền x-request-id),
//  6.7 thêm timeout/retry/circuit breaker. Giữ đơn giản ở 6.2 để thấy "trần trụi"
//  một cuộc gọi mạng giữa hai service trông thế nào.
// ============================================================================
import { env } from "../config/env.js";
import { ServiceUnavailable } from "@app/shared";

export interface Profile {
  id: string;
  email: string;
  name: string;
}

const BASE = `${env.USER_SERVICE_URL}/api/internal/users`;

export const userClient = {
  // Tạo profile ở user-service; nó tự sinh id và trả về.
  async createProfile(input: { email: string; name: string }): Promise<Profile> {
    let res: Response;
    try {
      res = await fetch(BASE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      throw ServiceUnavailable("Không gọi được user-service");
    }
    if (!res.ok) throw ServiceUnavailable(`user-service trả lỗi ${res.status} khi tạo profile`);
    return (await res.json()) as Profile;
  },

  // Đọc profile (lấy name). Best-effort: lỗi/timeout -> trả null để caller tự xử lý
  // (đăng nhập vẫn chạy được dù user-service đang chập chờn -> degrade gracefully).
  async getProfile(id: string): Promise<Profile | null> {
    try {
      const res = await fetch(`${BASE}/${id}`);
      if (!res.ok) return null;
      return (await res.json()) as Profile;
    } catch {
      return null;
    }
  },

  // Bù trừ saga: xoá profile vừa tạo nếu bước sau (tạo credential) thất bại.
  async deleteProfile(id: string): Promise<void> {
    try {
      await fetch(`${BASE}/${id}`, { method: "DELETE" });
    } catch {
      // nuốt lỗi — bù trừ là best-effort ở 6.2; 6.4 làm chặt hơn.
    }
  },
};
