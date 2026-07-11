// Đường dẫn tuyệt đối tới file .proto dùng chung, để service nạp bằng
// @grpc/proto-loader lúc chạy. Dùng import.meta.url -> đúng path dù cài qua pnpm.
import { fileURLToPath } from "node:url";

export const USER_PROTO_PATH = fileURLToPath(new URL("../proto/user.proto", import.meta.url));

// Kiểu message khớp user.proto (để client/server gõ đúng, tránh any trần trụi).
export interface GrpcProfile {
  id: string;
  email: string;
  name: string;
}
export interface GetProfileRequest {
  id: string;
}
