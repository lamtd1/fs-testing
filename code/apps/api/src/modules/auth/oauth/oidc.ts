// ============================================================================
//  OIDC HELPERS — các bước kỹ thuật của luồng Authorization Code + PKCE
// ============================================================================
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../../utils/errors.js";
import { logger } from "../../../lib/logger.js";
import type { ProviderConfig } from "./providers.js";

// --------------------------------------------------------------------------
// 1) DISCOVERY
// --------------------------------------------------------------------------
// Chuẩn OIDC quy định mỗi provider phải public một file JSON tại
//   {issuer}/.well-known/openid-configuration
// chứa mọi endpoint. Ta fetch 1 lần rồi CACHE lại (endpoint hiếm khi đổi) để
// khỏi gọi mạng mỗi request.
interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

const discoveryCache = new Map<string, Discovery>();

export async function discover(issuer: string): Promise<Discovery> {
  const cached = discoveryCache.get(issuer);
  if (cached) return cached;

  // Cẩn thận nối chuỗi: bỏ dấu "/" thừa ở cuối issuer để tránh "//".
  const url = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new AppError(502, `Không lấy được discovery của ${issuer}`, "OIDC_DISCOVERY_FAILED");
  }
  const doc = (await res.json()) as Discovery;
  discoveryCache.set(issuer, doc);
  logger.info({ issuer }, "OIDC discovery loaded");
  return doc;
}

// --------------------------------------------------------------------------
// 2) PKCE (Proof Key for Code Exchange)
// --------------------------------------------------------------------------
// Vấn đề: authorization code bị lộ (qua log/redirect) thì kẻ gian có thể đổi
// nó lấy token. PKCE chống lại bằng cách:
//   - Client tạo 1 chuỗi bí mật ngẫu nhiên: code_verifier.
//   - Gửi cho provider bản BĂM của nó: code_challenge = SHA256(verifier).
//   - Khi đổi code lấy token, client phải chìa ra verifier gốc; provider tự
//     băm lại và so khớp. Không có verifier gốc -> không đổi được token.
export function createPkce() {
  // base64url: chỉ chứa [A-Za-z0-9-_], không có dấu "+/=" (an toàn cho URL).
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

// state: chuỗi ngẫu nhiên chống CSRF (xem oauth.controller.ts để hiểu vì sao).
export function createState(): string {
  return base64url(randomBytes(16));
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

// --------------------------------------------------------------------------
// 3) DỰNG URL ĐỂ REDIRECT USER SANG TRANG ĐĂNG NHẬP CỦA PROVIDER
// --------------------------------------------------------------------------
export function buildAuthorizationUrl(opts: {
  provider: ProviderConfig;
  authorizationEndpoint: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(opts.authorizationEndpoint);
  // Dùng URLSearchParams để tự động encode giá trị đúng chuẩn.
  url.search = new URLSearchParams({
    response_type: "code", // ta muốn nhận về authorization CODE
    client_id: opts.provider.clientId,
    redirect_uri: opts.redirectUri,
    scope: opts.provider.scope,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256", // báo provider: challenge là SHA256
  }).toString();
  return url.toString();
}

// --------------------------------------------------------------------------
// 4) ĐỔI authorization code LẤY access token (server-to-server, có secret)
// --------------------------------------------------------------------------
interface TokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in?: number;
}

export async function exchangeCodeForToken(opts: {
  provider: ProviderConfig;
  tokenEndpoint: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri, // phải giống hệt lúc /authorize
    client_id: opts.provider.clientId,
    client_secret: opts.provider.clientSecret,
    code_verifier: opts.codeVerifier, // "chìa khoá" PKCE
  });

  const res = await fetch(opts.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, text }, "Token exchange failed");
    throw new AppError(502, "Đổi code lấy token thất bại", "OIDC_TOKEN_FAILED");
  }
  return (await res.json()) as TokenResponse;
}

// --------------------------------------------------------------------------
// 5) LẤY THÔNG TIN USER từ access token
// --------------------------------------------------------------------------
// Có 2 cách lấy thông tin user: (a) giải mã id_token (JWT), hoặc (b) gọi
// endpoint /userinfo kèm access token. Ta chọn (b) cho đơn giản & luôn đúng.
// (Production nghiêm ngặt nên verify chữ ký id_token — xem ghi chú tài liệu.)
export interface OidcUserInfo {
  sub: string; // id user bên provider — KHÔNG BAO GIỜ đổi
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export async function fetchUserInfo(userinfoEndpoint: string, accessToken: string): Promise<OidcUserInfo> {
  const res = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new AppError(502, "Lấy userinfo thất bại", "OIDC_USERINFO_FAILED");
  }
  return (await res.json()) as OidcUserInfo;
}
