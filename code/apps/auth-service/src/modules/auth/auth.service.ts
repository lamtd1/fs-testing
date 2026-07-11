// SERVICE auth: orchestrate register/login/refresh/logout/me.
// Điểm mới so với monolith: KHÔNG còn tự chứa profile (name). Nó GỌI user-service
// để tạo/đọc profile -> đây là chỗ "microservice" lộ rõ nhất.
import { Conflict, Unauthorized } from "@app/shared";
import type { RegisterInput, LoginInput, AuthUserDTO } from "@app/shared";
import { credentialRepository } from "./credential.repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "./token.service.js";
import { userClient } from "../../lib/user-client.js";
import { userGrpcClient } from "../../lib/user-grpc-client.js";
import { enqueueWelcomeEmail } from "../../queues/email.producer.js";
import { logger } from "../../lib/logger.js";

export const authService = {
  async register(input: RegisterInput): Promise<{
    user: AuthUserDTO;
    accessToken: string;
    refreshToken: string;
  }> {
    const existing = await credentialRepository.findByEmail(input.email);
    if (existing) throw Conflict("Email đã được sử dụng");

    // 1) Tạo profile ở user-service TRƯỚC (nó sinh userId và trả về).
    const profile = await userClient.createProfile({ email: input.email, name: input.name });

    try {
      // 2) Tạo credential trỏ về userId đó.
      const passwordHash = await hashPassword(input.password);
      const cred = await credentialRepository.create({
        userId: profile.id,
        email: input.email,
        passwordHash,
      });

      // 3) Phát event welcome email (best-effort — Redis lỗi KHÔNG làm hỏng đăng ký).
      try {
        await enqueueWelcomeEmail({ userId: cred.userId, email: cred.email, name: profile.name });
      } catch (err) {
        logger.error({ err }, "Không enqueue được welcome email (bỏ qua)");
      }

      const user: AuthUserDTO = {
        id: cred.userId,
        email: cred.email,
        name: profile.name,
        role: cred.role,
      };
      const accessToken = signAccessToken(cred);
      const refreshToken = await issueRefreshToken(cred.userId);
      return { user, accessToken, refreshToken };
    } catch (err) {
      // BÙ TRỪ sơ khai: profile đã tạo mà credential lỗi -> xoá profile mồ côi.
      // (6.4 sẽ nâng thành saga bài bản.)
      await userClient.deleteProfile(profile.id);
      throw err;
    }
  },

  async login(input: LoginInput): Promise<{
    user: AuthUserDTO;
    accessToken: string;
    refreshToken: string;
  }> {
    const cred = await credentialRepository.findByEmail(input.email);
    // Thông báo chung chung -> chống email enumeration.
    // passwordHash null = tài khoản CHỈ đăng nhập bằng OAuth -> không cho login mật khẩu.
    if (!cred || !cred.passwordHash) throw Unauthorized("Email hoặc mật khẩu không đúng");

    const ok = await verifyPassword(cred.passwordHash, input.password);
    if (!ok) throw Unauthorized("Email hoặc mật khẩu không đúng");

    // Login TỰ CHỦ: role đã có trong credential -> cấp JWT không cần user-service.
    // Chỉ lấy `name` để hiển thị (best-effort; user-service chập chờn vẫn login được).
    // ĐỌC qua gRPC (6.3) — truyền correlation-id trong metadata.
    const profile = await userGrpcClient.getProfile(cred.userId);
    const name = profile?.name ?? cred.email.split("@")[0] ?? cred.email;

    const user: AuthUserDTO = { id: cred.userId, email: cred.email, name, role: cred.role };
    const accessToken = signAccessToken(cred);
    const refreshToken = await issueRefreshToken(cred.userId);
    return { user, accessToken, refreshToken };
  },

  async refresh(oldRefreshToken: string) {
    const { userId, newRefreshToken } = await rotateRefreshToken(oldRefreshToken);
    const cred = await credentialRepository.findById(userId);
    if (!cred) throw Unauthorized("Người dùng không còn tồn tại");
    const accessToken = signAccessToken(cred);
    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken: string | undefined) {
    if (refreshToken) await revokeRefreshToken(refreshToken);
  },

  async me(userId: string): Promise<AuthUserDTO> {
    const cred = await credentialRepository.findById(userId);
    if (!cred) throw Unauthorized("Người dùng không còn tồn tại");
    const profile = await userGrpcClient.getProfile(userId);
    return {
      id: cred.userId,
      email: cred.email,
      name: profile?.name ?? "",
      role: cred.role,
    };
  },
};
