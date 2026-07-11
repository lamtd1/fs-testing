// ROUTES công khai (qua gateway) — quản trị user. Yêu cầu đăng nhập + quyền ADMIN.
import { Router } from "express";
import { validate, asyncHandler, trustGatewayUser, authorize } from "@app/shared";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from "@app/shared";
import { userController } from "./user.controller.js";
import { env } from "../../config/env.js";

// (7.3) KHÔNG tự verify JWT nữa: tin context do gateway gắn (x-user-*), sau khi
// kiểm x-gateway-token. Vẫn tự enforce RBAC ADMIN từ role trong context.
const gatewayUser = trustGatewayUser(env.GATEWAY_SECRET);

export const userRoutes = Router();

userRoutes.use(gatewayUser, authorize("ADMIN"));

userRoutes.get("/", validate({ query: listUsersQuerySchema }), asyncHandler(userController.list));
userRoutes.get("/:id", validate({ params: userIdParamSchema }), asyncHandler(userController.getById));
userRoutes.post("/", validate({ body: createUserSchema }), asyncHandler(userController.create));
userRoutes.patch(
  "/:id",
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  asyncHandler(userController.update),
);
userRoutes.delete("/:id", validate({ params: userIdParamSchema }), asyncHandler(userController.remove));
