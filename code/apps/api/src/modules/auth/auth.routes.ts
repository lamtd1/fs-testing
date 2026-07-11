import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { registerSchema, loginSchema } from "./auth.schema.js";

export const authRoutes = Router();

authRoutes.post("/register", validate({ body: registerSchema }), asyncHandler(authController.register));
authRoutes.post("/login", validate({ body: loginSchema }), asyncHandler(authController.login));
authRoutes.post("/refresh", asyncHandler(authController.refresh));
authRoutes.post("/logout", asyncHandler(authController.logout));

// Route được bảo vệ: phải có access token hợp lệ.
authRoutes.get("/me", authenticate, asyncHandler(authController.me));
