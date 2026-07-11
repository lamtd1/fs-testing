import { Router } from "express";
import { asyncHandler } from "@app/shared";
import { oauthController } from "./oauth.controller.js";

// Mount tại /api/auth/oauth (xem auth.routes.ts). :provider = "google" | "keycloak".
export const oauthRoutes = Router();

oauthRoutes.get("/:provider/login", asyncHandler(oauthController.login));
oauthRoutes.get("/:provider/callback", asyncHandler(oauthController.callback));
