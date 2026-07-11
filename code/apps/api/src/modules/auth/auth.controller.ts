// CONTROLLER auth: quản HTTP + cookie.
// Chiến lược lưu token (best practice cho SPA):
//   - REFRESH token -> httpOnly cookie: JS của trang KHÔNG đọc được -> chống XSS
//     đánh cắp refresh token. sameSite=lax + path hẹp -> giảm rủi ro CSRF.
//   - ACCESS token  -> trả trong body, client giữ trong BỘ NHỚ (memory), không
//     lưu localStorage. Hết hạn nhanh nên rủi ro thấp.
import type { Request, Response } from "express";
import { authService } from "./auth.service.js";
import { Unauthorized } from "../../utils/errors.js";
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from "./cookies.js";

export const authController = {
  async register(req: Request, res: Response) {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
  },

  async login(req: Request, res: Response) {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    setRefreshCookie(res, refreshToken);
    res.json({ user, accessToken });
  },

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw Unauthorized("Thiếu refresh token");

    const { accessToken, refreshToken } = await authService.refresh(token);
    setRefreshCookie(res, refreshToken); // rotation: set token MỚI
    res.json({ accessToken });
  },

  async logout(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await authService.logout(token);
    clearRefreshCookie(res);
    res.status(204).send();
  },

  // Trả PROFILE đầy đủ của user đang đăng nhập (id, name, email, role...).
  // req.user chỉ chứa payload token (sub/email/role) -> ta lấy full từ DB qua sub.
  async me(req: Request, res: Response) {
    const user = await authService.me(req.user!.sub);
    res.json({ user });
  },
};
