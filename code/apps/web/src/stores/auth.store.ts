// ============================================================================
//  AUTH STORE (Zustand) — chỉ giữ CLIENT STATE của phiên đăng nhập.
// ----------------------------------------------------------------------------
//  Lưu ý cực quan trọng: accessToken chỉ nằm TRONG BỘ NHỚ (biến JS), KHÔNG
//  persist vào localStorage. Vì localStorage đọc được bằng JS -> XSS lấy được.
//  Mất token khi F5 là CHỦ Ý: lúc đó ta "silent refresh" bằng cookie (xem App.tsx).
//
//  Vì sao Zustand chứ không phải TanStack Query cho cái này? Vì access token là
//  "client state" (trạng thái của riêng client), không phải "server state" (dữ
//  liệu lấy từ server và cần cache/đồng bộ). Phân biệt này là nguyên tắc chính
//  của kiến trúc state hiện đại: server state -> React Query, client state -> Zustand.
// ============================================================================
import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  // status giúp UI biết đang khởi động (chưa rõ đăng nhập hay chưa) để tránh
  // "nháy" trang login trước khi silent-refresh xong.
  status: "loading" | "authenticated" | "unauthenticated";

  setAuth: (token: string, user: User | null) => void;
  setAccessToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "loading",

  setAuth: (token, user) => set({ accessToken: token, user, status: "authenticated" }),
  // CHỈ cập nhật token, KHÔNG đổi status. Dùng cho interceptor khi refresh giữa
  // chừng, và cho bootstrap (set token trước khi gọi /me). Việc quyết định "đã
  // đăng nhập" (status) chỉ do setAuth/clear làm -> tránh trạng thái nửa vời
  // (authenticated nhưng user=null) khiến route guard hiểu nhầm.
  setAccessToken: (token) => set({ accessToken: token }),
  clear: () => set({ accessToken: null, user: null, status: "unauthenticated" }),
}));
