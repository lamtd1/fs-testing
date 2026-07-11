// Mở rộng type của Express để có req.id (correlation-id) và req.user (đã auth).
// File này chỉ khai báo type toàn cục; import ở index để mọi service nhận được.
import type { AuthUser } from "./auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      user?: AuthUser;
    }
  }
}

export {};
