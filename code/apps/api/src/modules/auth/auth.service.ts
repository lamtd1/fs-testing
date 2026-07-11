// SERVICE auth: orchestrate register / login / refresh / logout.
// Không biết gì về HTTP hay cookie -> chỉ trả token + thông tin user.
import { userRepository } from "../user/user.repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "./token.service.js";
import { Conflict, Unauthorized } from "../../utils/errors.js";
import { enqueueWelcomeEmail } from "../../queues/email/email.queue.js";
import { logger } from "../../lib/logger.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

// Chỉ trả những field an toàn cho client (KHÔNG lộ passwordHash).
function toPublicUser(u: { id: string; email: string; name: string; role: string }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw Conflict("Email đã được sử dụng");

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.createWithPassword({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    // Gửi email chào mừng KHÔNG đồng bộ: chỉ THẢ job vào queue rồi đi tiếp.
    // Việc gửi thật do worker làm nền -> user không phải chờ SMTP.
    // Bọc try/catch: nếu Redis/queue có trục trặc, KHÔNG được làm hỏng việc
    // đăng ký (email chào mừng là "nice-to-have", không phải bắt buộc).
    try {
      await enqueueWelcomeEmail({ userId: user.id, email: user.email, name: user.name });
    } catch (err) {
      logger.error({ err }, "Không enqueue được welcome email (bỏ qua)");
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);
    return { user: toPublicUser(user), accessToken, refreshToken };
  },

  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email);
    // Thông báo lỗi CHUNG CHUNG để không lộ email nào tồn tại (chống enumeration).
    if (!user || !user.passwordHash) throw Unauthorized("Email hoặc mật khẩu không đúng");

    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) throw Unauthorized("Email hoặc mật khẩu không đúng");

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);
    return { user: toPublicUser(user), accessToken, refreshToken };
  },

  async refresh(oldRefreshToken: string) {
    const { userId, newRefreshToken } = await rotateRefreshToken(oldRefreshToken);
    const user = await userRepository.findById(userId);
    if (!user) throw Unauthorized("Người dùng không còn tồn tại");

    const accessToken = signAccessToken(user);
    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken: string | undefined) {
    if (refreshToken) await revokeRefreshToken(refreshToken);
  },

  // Profile của user đang đăng nhập (dùng cho GET /me).
  async me(userId: string) {
    const user = await userRepository.findById(userId); // đã dùng publicUserSelect
    if (!user) throw Unauthorized("Người dùng không còn tồn tại");
    return user;
  },
};
