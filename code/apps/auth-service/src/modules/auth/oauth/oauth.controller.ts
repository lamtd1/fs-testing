// CONTROLLER OAuth: 2 endpoint login/callback (Authorization Code + PKCE).
import type { Request, Response } from "express";
import { NotFound, BadRequest } from "@app/shared";
import { redis } from "../../../lib/redis.js";
import { env } from "../../../config/env.js";
import { getProvider, redirectUri } from "./providers.js";
import {
  discover,
  createPkce,
  createState,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchUserInfo,
} from "./oidc.js";
import { oauthService } from "./oauth.service.js";
import { setRefreshCookie } from "../cookies.js";

const STATE_TTL_SEC = 600;
const stateKey = (state: string) => `oauth-state:${state}`;

export const oauthController = {
  async login(req: Request, res: Response) {
    const providerName = req.params.provider as string;
    const provider = getProvider(providerName);
    if (!provider) throw NotFound(`Provider "${providerName}" chưa được cấu hình`);

    const { authorization_endpoint } = await discover(provider.issuer);
    const { codeVerifier, codeChallenge } = createPkce();
    const state = createState();

    await redis.set(
      stateKey(state),
      JSON.stringify({ codeVerifier, provider: providerName }),
      "EX",
      STATE_TTL_SEC,
    );

    res.redirect(
      buildAuthorizationUrl({
        provider,
        authorizationEndpoint: authorization_endpoint,
        redirectUri: redirectUri(providerName),
        state,
        codeChallenge,
      }),
    );
  },

  async callback(req: Request, res: Response) {
    const providerName = req.params.provider as string;
    const { code, state, error } = req.query as Record<string, string | undefined>;

    if (error) {
      return res.redirect(`${env.FRONTEND_URL}/login?oauth_error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) throw BadRequest("Thiếu code hoặc state");

    const raw = await redis.get(stateKey(state));
    if (!raw) throw BadRequest("State không hợp lệ hoặc đã hết hạn (nghi CSRF)");
    await redis.del(stateKey(state));

    const { codeVerifier, provider: storedProvider } = JSON.parse(raw) as {
      codeVerifier: string;
      provider: string;
    };
    if (storedProvider !== providerName) throw BadRequest("Provider không khớp với state");

    const provider = getProvider(providerName);
    if (!provider) throw NotFound(`Provider "${providerName}" chưa được cấu hình`);

    const { token_endpoint, userinfo_endpoint } = await discover(provider.issuer);
    const token = await exchangeCodeForToken({
      provider,
      tokenEndpoint: token_endpoint,
      code,
      redirectUri: redirectUri(providerName),
      codeVerifier,
    });
    const info = await fetchUserInfo(userinfo_endpoint, token.access_token);

    const { refreshToken } = await oauthService.loginWithOAuth(providerName, info);

    setRefreshCookie(res, refreshToken);
    res.redirect(`${env.FRONTEND_URL}/auth/callback?login=success`);
  },
};
