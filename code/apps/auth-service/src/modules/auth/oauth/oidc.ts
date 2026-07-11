// OIDC helpers: discovery + PKCE + build authorize URL + exchange code + userinfo.
// (Giải thích chi tiết từng bước xem Phần 3.)
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@app/shared";
import { logger } from "../../../lib/logger.js";
import type { ProviderConfig } from "./providers.js";

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

const discoveryCache = new Map<string, Discovery>();

export async function discover(issuer: string): Promise<Discovery> {
  const cached = discoveryCache.get(issuer);
  if (cached) return cached;
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

export function createPkce() {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function createState(): string {
  return base64url(randomBytes(16));
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function buildAuthorizationUrl(opts: {
  provider: ProviderConfig;
  authorizationEndpoint: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(opts.authorizationEndpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: opts.provider.clientId,
    redirect_uri: opts.redirectUri,
    scope: opts.provider.scope,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

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
    redirect_uri: opts.redirectUri,
    client_id: opts.provider.clientId,
    client_secret: opts.provider.clientSecret,
    code_verifier: opts.codeVerifier,
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

export interface OidcUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export async function fetchUserInfo(
  userinfoEndpoint: string,
  accessToken: string,
): Promise<OidcUserInfo> {
  const res = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new AppError(502, "Lấy userinfo thất bại", "OIDC_USERINFO_FAILED");
  }
  return (await res.json()) as OidcUserInfo;
}
