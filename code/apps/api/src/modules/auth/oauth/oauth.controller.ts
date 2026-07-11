// ============================================================================
//  CONTROLLER OAuth — điều phối luồng Authorization Code + PKCE qua 2 endpoint:
//    GET /api/auth/oauth/:provider/login     -> đẩy user sang trang provider
//    GET /api/auth/oauth/:provider/callback  -> provider gọi ngược lại kèm code
// ============================================================================
import type { Request, Response } from "express";
import { redis } from "../../../lib/redis.js";
import { env } from "../../../config/env.js";
import { NotFound, BadRequest } from "../../../utils/errors.js";
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

// Ta lưu tạm (state -> {codeVerifier, provider}) trong Redis 10 phút.
// state là "vé giữ chỗ" cho một lần đăng nhập đang diễn ra.
const STATE_TTL_SEC = 600;
const stateKey = (state: string) => `oauth-state:${state}`;

export const oauthController = {
  // ----- BƯỚC 1: khởi tạo -----
  async login(req: Request, res: Response) {
    const providerName = req.params.provider as string;
    const provider = getProvider(providerName);
    if (!provider) throw NotFound(`Provider "${providerName}" chưa được cấu hình`);

    const { authorization_endpoint } = await discover(provider.issuer);

    // Sinh code_verifier (bí mật) + code_challenge (bản băm để gửi đi), và
    // state (chống CSRF). code_verifier KHÔNG gửi lúc này — giữ lại ở server.
    const { codeVerifier, codeChallenge } = createPkce();
    const state = createState();

    await redis.set(
      stateKey(state),
      JSON.stringify({ codeVerifier, provider: providerName }),
      "EX",
      STATE_TTL_SEC,
    );

    const url = buildAuthorizationUrl({
      provider,
      authorizationEndpoint: authorization_endpoint,
      redirectUri: redirectUri(providerName),
      state,
      codeChallenge,
    });

    // Đẩy trình duyệt sang trang đăng nhập của provider.
    res.redirect(url);
  },

  // ----- BƯỚC 2: provider gọi lại kèm ?code & ?state -----
  async callback(req: Request, res: Response) {
    const providerName = req.params.provider as string;
    const { code, state, error } = req.query as Record<string, string | undefined>;

    // Provider báo lỗi (vd user bấm "Từ chối") -> đưa về frontend kèm lý do.
    if (error) {
      return res.redirect(`${env.FRONTEND_URL}/login?oauth_error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) throw BadRequest("Thiếu code hoặc state");

    // Kiểm tra state: đây là lá chắn CSRF. Nếu state không có trong Redis nghĩa
    // là request này KHÔNG do luồng /login của ta khởi tạo -> từ chối.
    const raw = await redis.get(stateKey(state));
    if (!raw) throw BadRequest("State không hợp lệ hoặc đã hết hạn (nghi CSRF)");
    await redis.del(stateKey(state)); // state dùng 1 lần rồi bỏ

    const { codeVerifier, provider: storedProvider } = JSON.parse(raw) as {
      codeVerifier: string;
      provider: string;
    };
    // Chống lẫn provider giữa /login và /callback.
    if (storedProvider !== providerName) throw BadRequest("Provider không khớp với state");

    const provider = getProvider(providerName);
    if (!provider) throw NotFound(`Provider "${providerName}" chưa được cấu hình`);

    const { token_endpoint, userinfo_endpoint } = await discover(provider.issuer);

    // Đổi code (+ code_verifier) lấy access token, rồi lấy thông tin user.
    const token = await exchangeCodeForToken({
      provider,
      tokenEndpoint: token_endpoint,
      code,
      redirectUri: redirectUri(providerName),
      codeVerifier,
    });
    const info = await fetchUserInfo(userinfo_endpoint, token.access_token);

    // Đổi danh tính provider -> user nội bộ + cấp token của hệ thống ta.
    const { refreshToken } = await oauthService.loginWithOAuth(providerName, info);

    // Đặt refresh token vào httpOnly cookie rồi đưa trình duyệt về frontend.
    // Frontend sẽ gọi /api/auth/refresh (cookie có sẵn) để lấy access token.
    // -> access token KHÔNG lộ trên URL.
    setRefreshCookie(res, refreshToken);
    res.redirect(`${env.FRONTEND_URL}/auth/callback?login=success`);
  },
};
