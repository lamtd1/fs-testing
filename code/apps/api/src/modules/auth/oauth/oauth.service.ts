// SERVICE OAuth: biến thông tin từ provider thành 1 User nội bộ (account linking),
// rồi cấp access + refresh token CỦA HỆ THỐNG TA (tái dùng token.service Phần 2).
// Tức là: OAuth chỉ dùng để XÁC MINH danh tính; sau đó user dùng token của ta.
import { oauthRepository } from "./oauth.repository.js";
import { signAccessToken, issueRefreshToken } from "../token.service.js";
import { AppError, BadRequest } from "../../../utils/errors.js";
import type { OidcUserInfo } from "./oidc.js";

export const oauthService = {
  // Trả về { accessToken, refreshToken } cho user tương ứng.
  async loginWithOAuth(provider: string, info: OidcUserInfo) {
    if (!info.email) {
      throw BadRequest("Provider không trả về email — không thể tạo tài khoản");
    }

    // (1) Đã từng đăng nhập bằng tài khoản OAuth này -> chính là login.
    let user = await oauthRepository.findUserByOAuthAccount(provider, info.sub);

    if (!user) {
      // (2) Chưa liên kết. Thử khớp theo email với user đã có.
      const existing = await oauthRepository.findUserByEmail(info.email);

      if (existing) {
        // QUAN TRỌNG (bảo mật): chỉ auto-link khi provider XÁC NHẬN email đã
        // verified. Nếu không, kẻ gian tạo tài khoản Google với email của bạn
        // (chưa verify) có thể chiếm tài khoản nội bộ của bạn.
        if (info.email_verified === false) {
          throw new AppError(403, "Email chưa được xác minh bởi provider", "EMAIL_NOT_VERIFIED");
        }
        await oauthRepository.linkAccount(existing.id, provider, info.sub);
        user = existing;
      } else {
        // (3) Hoàn toàn mới -> tạo user + liên kết. User này KHÔNG có password
        // (passwordHash = null), chỉ đăng nhập được qua OAuth cho tới khi họ đặt mật khẩu.
        user = await oauthRepository.createUserWithAccount({
          email: info.email,
          name: info.name ?? info.email,
          provider,
          providerAccountId: info.sub,
        });
      }
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  },
};
