// ============================================================================
//  PROVIDER REGISTRY
// ----------------------------------------------------------------------------
//  Mỗi provider OAuth (Google, Keycloak, GitHub...) khác nhau ở 3 thứ:
//    1. client_id / client_secret (ta đăng ký với họ)
//    2. "issuer" — địa chỉ gốc để tìm các endpoint (authorize, token, userinfo)
//    3. scope muốn xin
//  Nhờ chuẩn OIDC, chỉ cần biết issuer là ta TỰ TÌM ĐƯỢC các endpoint qua
//  "discovery document" (xem oidc.ts) -> không phải hardcode URL cho từng bên.
// ============================================================================
import { env } from "../../../config/env.js";

export interface ProviderConfig {
  name: string;
  issuer: string; // gốc để discovery
  clientId: string;
  clientSecret: string;
  scope: string; // các scope, cách nhau bằng dấu cách
}

// Xây redirect_uri (nơi provider gọi ngược lại api của ta) từ tên provider.
// PHẢI trùng khít với giá trị đã khai báo trong dashboard của provider.
export function redirectUri(provider: string): string {
  return `${env.OAUTH_REDIRECT_BASE}/api/auth/oauth/${provider}/callback`;
}

// Trả về config của provider theo tên, hoặc null nếu chưa cấu hình env.
// Trả null (thay vì throw) để app vẫn chạy khi bạn chỉ bật 1 trong 2 provider.
export function getProvider(name: string): ProviderConfig | null {
  if (name === "google") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
    return {
      name: "google",
      issuer: "https://accounts.google.com",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      scope: "openid email profile",
    };
  }

  if (name === "keycloak") {
    if (!env.KEYCLOAK_ISSUER || !env.KEYCLOAK_CLIENT_ID || !env.KEYCLOAK_CLIENT_SECRET)
      return null;
    return {
      name: "keycloak",
      issuer: env.KEYCLOAK_ISSUER,
      clientId: env.KEYCLOAK_CLIENT_ID,
      clientSecret: env.KEYCLOAK_CLIENT_SECRET,
      scope: "openid email profile",
    };
  }

  return null;
}
