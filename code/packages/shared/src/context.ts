// ============================================================================
//  REQUEST CONTEXT — mang correlation-id XUYÊN các lớp mà KHÔNG phải luồn `req`
//  qua từng hàm. Dùng AsyncLocalStorage (ALS) của Node: mọi code chạy trong
//  cùng một request "nhìn thấy" cùng một store, kể cả sau await.
// ----------------------------------------------------------------------------
//  Nhờ đó `user-client` (tận sâu trong service) lấy được requestId để gắn header
//  x-request-id khi gọi sang service khác -> log của cả chuỗi cùng một id.
// ============================================================================
import { AsyncLocalStorage } from "node:async_hooks";

interface RequestStore {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

// Lấy requestId hiện tại (nếu đang trong một request).
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
