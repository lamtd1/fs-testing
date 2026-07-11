// ROUTES: khai báo endpoint + gắn validate + trỏ tới controller.
// Đây là nơi "ráp" mọi thứ của module user lại.
import { Router } from "express";
import { userController } from "./user.controller.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from "./user.schema.js";

export const userRoutes = Router();

userRoutes.get(
  "/",
  validate({ query: listUsersQuerySchema }),
  asyncHandler(userController.list),
);

userRoutes.get(
  "/:id",
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.getById),
);

userRoutes.post(
  "/",
  validate({ body: createUserSchema }),
  asyncHandler(userController.create),
);

userRoutes.patch(
  "/:id",
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  asyncHandler(userController.update),
);

userRoutes.delete(
  "/:id",
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.remove),
);
