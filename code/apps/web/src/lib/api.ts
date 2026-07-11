// ============================================================================
//  AXIOS INSTANCE + INTERCEPTORS
// ----------------------------------------------------------------------------
//  Đây là "cổng" duy nhất để nói chuyện với backend. Hai việc nó tự lo:
//   1) Đính access token vào mỗi request (request interceptor).
//   2) Khi gặp 401 (access token hết hạn) -> tự gọi /refresh lấy token mới rồi
//      thử lại request gốc, HOÀN TOÀN TRONG SUỐT với phần còn lại của app
//      (response interceptor). Component không cần biết token đã hết hạn.
// ============================================================================
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth.store";

// baseURL rỗng -> gọi đường dẫn tương đối "/api/..." -> đi qua Vite proxy
// (dev) hoặc reverse proxy (prod). Không hardcode host -> deploy đâu chạy đó.
export const api = axios.create({
  baseURL: "",
  withCredentials: true, // luôn gửi cookie (refresh token) kèm request
});

// --- (1) REQUEST: gắn "Authorization: Bearer <accessToken>" ---
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- (2) RESPONSE: tự refresh khi 401 ---
// Đánh dấu request nào đã thử lại rồi để không lặp vô hạn.
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Khi access token hết hạn, có thể NHIỀU request cùng nhận 401 một lúc. Ta chỉ
// muốn gọi /refresh MỘT LẦN, các request kia xếp hàng chờ token mới. Cơ chế:
let isRefreshing = false;
let waiters: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  waiters.forEach((cb) => cb(token));
  waiters = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    // Không phải 401, hoặc không có config -> ném tiếp cho nơi gọi xử lý.
    if (!original || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    // Nếu CHÍNH /refresh trả 401 -> refresh token cũng hết hạn -> hết cứu -> logout.
    if (original.url?.includes("/api/auth/refresh")) {
      useAuthStore.getState().clear();
      return Promise.reject(error);
    }
    // Đã thử lại rồi mà vẫn 401 -> thôi.
    if (original._retry) {
      useAuthStore.getState().clear();
      return Promise.reject(error);
    }
    original._retry = true;

    // Nếu đang có một lượt refresh chạy -> xếp hàng chờ, xong thì thử lại.
    if (isRefreshing) {
      return new Promise((resolve) => {
        waiters.push((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    // Ta là request đầu tiên gặp 401 -> đứng ra gọi /refresh.
    isRefreshing = true;
    try {
      const { data } = await api.post<{ accessToken: string }>("/api/auth/refresh");
      const newToken = data.accessToken;
      useAuthStore.getState().setAccessToken(newToken);
      onRefreshed(newToken); // đánh thức các request đang chờ
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original); // thử lại request gốc
    } catch (refreshErr) {
      useAuthStore.getState().clear();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
