import { Router } from "express";
import { oauthController } from "./oauth.controller.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

// Mount tại /api/auth/oauth (xem app.ts). :provider = "google" | "keycloak".
export const oauthRoutes = Router();

oauthRoutes.get("/:provider/login", asyncHandler(oauthController.login));
oauthRoutes.get("/:provider/callback", asyncHandler(oauthController.callback));
