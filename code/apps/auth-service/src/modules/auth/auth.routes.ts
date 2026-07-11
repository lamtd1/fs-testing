import { Router } from "express";
import { validate, asyncHandler, trustGatewayUser, registerSchema, loginSchema } from "@app/shared";
import { authController } from "./auth.controller.js";
import { oauthRoutes } from "./oauth/oauth.routes.js";
import { env } from "../../config/env.js";

// (7.3) /me tin context do gateway gắn (gateway đã verify JWT) thay vì tự verify.
const gatewayUser = trustGatewayUser(env.GATEWAY_SECRET);

export const authRoutes = Router();

// Đăng nhập qua provider ngoài: /api/auth/oauth/:provider/{login,callback}
authRoutes.use("/oauth", oauthRoutes);

authRoutes.post("/register", validate({ body: registerSchema }), asyncHandler(authController.register));
authRoutes.post("/login", validate({ body: loginSchema }), asyncHandler(authController.login));
authRoutes.post("/refresh", asyncHandler(authController.refresh));
authRoutes.post("/logout", asyncHandler(authController.logout));
authRoutes.get("/me", gatewayUser, asyncHandler(authController.me));
