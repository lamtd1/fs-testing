// ROUTES NỘI BỘ (service-to-service) — auth-service gọi khi register/login.
// KHÔNG expose qua gateway; hiện tin tưởng "mạng nội bộ". Ở 6.5 ta sẽ siết bằng
// secret/mTLS. Không cần JWT vì đây là gọi giữa service, không phải từ trình duyệt.
import { Router } from "express";
import { validate, asyncHandler, createUserSchema, userIdParamSchema } from "@app/shared";
import { userController } from "./user.controller.js";

export const internalUserRoutes = Router();

// Tạo profile (auth-service sinh credential rồi gọi sang đây). id do user-service sinh.
internalUserRoutes.post("/", validate({ body: createUserSchema }), asyncHandler(userController.create));

// Lấy profile theo id (auth-service dùng để lấy `name` khi login/me).
internalUserRoutes.get(
  "/:id",
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.getById),
);

// Xoá profile — dùng cho BÙ TRỪ saga khi register lỗi ở bước tạo credential.
internalUserRoutes.delete(
  "/:id",
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.remove),
);
