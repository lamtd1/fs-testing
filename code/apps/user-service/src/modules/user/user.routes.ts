// ROUTES công khai (qua gateway) — quản trị user. Yêu cầu đăng nhập + quyền ADMIN.
import { Router } from "express";
import { validate, asyncHandler, createAuthenticate, authorize } from "@app/shared";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from "@app/shared";
import { userController } from "./user.controller.js";
import { env } from "../../config/env.js";

const authenticate = createAuthenticate(env.JWT_ACCESS_SECRET);

export const userRoutes = Router();

// Mọi route dưới đây đều cần ADMIN (giống monolith Phần 2, nhưng nay tự verify JWT).
userRoutes.use(authenticate, authorize("ADMIN"));

userRoutes.get("/", validate({ query: listUsersQuerySchema }), asyncHandler(userController.list));
userRoutes.get("/:id", validate({ params: userIdParamSchema }), asyncHandler(userController.getById));
userRoutes.post("/", validate({ body: createUserSchema }), asyncHandler(userController.create));
userRoutes.patch(
  "/:id",
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  asyncHandler(userController.update),
);
userRoutes.delete("/:id", validate({ params: userIdParamSchema }), asyncHandler(userController.remove));
