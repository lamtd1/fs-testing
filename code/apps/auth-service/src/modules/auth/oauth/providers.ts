// Registry provider OAuth. Chỉ cần biết issuer -> tự discovery endpoint (oidc.ts).
import { env } from "../../../config/env.js";

export interface ProviderConfig {
  name: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

// redirect_uri trỏ về GATEWAY (:4000), gateway proxy sang auth-service.
// Phải trùng khít giá trị khai báo trong dashboard provider.
export function redirectUri(provider: string): string {
  return `${env.OAUTH_REDIRECT_BASE}/api/auth/oauth/${provider}/callback`;
}

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
    if (!env.KEYCLOAK_ISSUER || !env.KEYCLOAK_CLIENT_ID || !env.KEYCLOAK_CLIENT_SECRET) return null;
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
