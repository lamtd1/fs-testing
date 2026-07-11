import { Router } from "express";
import { validate, asyncHandler, createAuthenticate, registerSchema, loginSchema } from "@app/shared";
import { authController } from "./auth.controller.js";
import { env } from "../../config/env.js";

const authenticate = createAuthenticate(env.JWT_ACCESS_SECRET);

export const authRoutes = Router();

authRoutes.post("/register", validate({ body: registerSchema }), asyncHandler(authController.register));
authRoutes.post("/login", validate({ body: loginSchema }), asyncHandler(authController.login));
authRoutes.post("/refresh", asyncHandler(authController.refresh));
authRoutes.post("/logout", asyncHandler(authController.logout));
authRoutes.get("/me", authenticate, asyncHandler(authController.me));
