// Middleware phân quyền (RBAC). Dùng SAU authenticate.
// Ví dụ: router.get("/admin", authenticate, authorize("ADMIN"), handler)
import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { Unauthorized, Forbidden } from "../utils/errors.js";

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(Forbidden("Bạn không có quyền truy cập tài nguyên này"));
    }
    next();
  };
}
