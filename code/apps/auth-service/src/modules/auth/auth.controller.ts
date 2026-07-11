import type { Request, Response } from "express";
import { Unauthorized } from "@app/shared";
import { authService } from "./auth.service.js";
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
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  },

  async logout(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await authService.logout(token);
    clearRefreshCookie(res);
    res.status(204).send();
  },

  async me(req: Request, res: Response) {
    const user = await authService.me(req.user!.sub);
    res.json({ user });
  },
};
