// ============================================================================
//  BFF (Backend-for-Frontend) — gateway TỰ gọi nhiều service rồi gộp thành MỘT
//  response gọn cho FE. Thay vì FE gọi 2-3 API rồi tự ghép (nhiều round-trip,
//  lộ topology), FE gọi 1 endpoint; gateway fan-out + gom lại.
// ============================================================================
import { Router } from "express";
import type { Request } from "express";
import {
  asyncHandler,
  serviceRegistry,
  getRequestId,
  REQUEST_ID_HEADER,
  GATEWAY_TOKEN_HEADER,
  USER_ID_HEADER,
  USER_ROLE_HEADER,
  USER_EMAIL_HEADER,
  type AuthUser,
} from "@app/shared";
import { env } from "../config/env.js";

export const bffRoutes = Router();

// Gắn context xuống service (giống proxy 7.3): bằng chứng gateway + danh tính.
function ctxHeaders(user: AuthUser): Record<string, string> {
  const h: Record<string, string> = {
    [GATEWAY_TOKEN_HEADER]: env.GATEWAY_SECRET,
    [USER_ID_HEADER]: user.sub,
    [USER_ROLE_HEADER]: user.role,
    [USER_EMAIL_HEADER]: user.email,
  };
  const rid = getRequestId();
  if (rid) h[REQUEST_ID_HEADER] = rid;
  return h;
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface MeResponse {
  user: { id: string; email: string; name: string; role: string };
}
interface UsersResponse {
  items: Array<{ id: string; email: string; name: string }>;
  pagination: { total: number };
}

// GET /api/bff/overview — dữ liệu cho trang dashboard, gộp từ auth + user service.
bffRoutes.get(
  "/overview",
  asyncHandler(async (req: Request, res) => {
    const user = req.user!; // đã qua requireAuth ở gateway
    const headers = ctxHeaders(user);

    // Fan-out SONG SONG. Admin thì lấy thêm thống kê user.
    const [me, users] = await Promise.all([
      getJson<MeResponse>(`${serviceRegistry.authHttp()}/api/auth/me`, headers),
      user.role === "ADMIN"
        ? getJson<UsersResponse>(`${serviceRegistry.userHttp()}/api/users?page=1&limit=5`, headers)
        : Promise.resolve(null),
    ]);

    res.json({
      me: me?.user ?? { id: user.sub, email: user.email, role: user.role, name: "" },
      admin:
        user.role === "ADMIN"
          ? { totalUsers: users?.pagination.total ?? 0, recentUsers: users?.items ?? [] }
          : null,
    });
  }),
);
