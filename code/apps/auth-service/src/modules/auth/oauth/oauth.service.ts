// SERVICE OAuth: đổi danh tính provider -> credential nội bộ (account linking),
// rồi cấp access + refresh token CỦA HỆ THỐNG TA. User mới -> tạo profile ở
// user-service (giống register), nên đây cũng là một luồng liên service.
import { AppError, BadRequest } from "@app/shared";
import { oauthRepository } from "./oauth.repository.js";
import { signAccessToken, issueRefreshToken } from "../token.service.js";
import { userClient } from "../../../lib/user-client.js";
import type { OidcUserInfo } from "./oidc.js";

export const oauthService = {
  async loginWithOAuth(provider: string, info: OidcUserInfo) {
    if (!info.email) throw BadRequest("Provider không trả về email — không thể tạo tài khoản");

    // (1) Đã liên kết OAuth account này -> chính là login.
    let cred = await oauthRepository.findCredentialByOAuthAccount(provider, info.sub);

    if (!cred) {
      // (2) Chưa liên kết -> thử khớp theo email.
      const existing = await oauthRepository.findCredentialByEmail(info.email);
      if (existing) {
        // Chỉ auto-link khi provider đã xác minh email (chống chiếm tài khoản).
        if (info.email_verified === false) {
          throw new AppError(403, "Email chưa được xác minh bởi provider", "EMAIL_NOT_VERIFIED");
        }
        await oauthRepository.linkAccount(existing.userId, provider, info.sub);
        cred = existing;
      } else {
        // (3) User mới: tạo profile ở user-service -> tạo credential (không mật khẩu) + link.
        const profile = await userClient.createProfile({
          email: info.email,
          name: info.name ?? info.email,
        });
        try {
          cred = await oauthRepository.createCredentialWithAccount({
            userId: profile.id,
            email: info.email,
            provider,
            providerAccountId: info.sub,
          });
        } catch (err) {
          await userClient.deleteProfile(profile.id); // bù trừ
          throw err;
        }
      }
    }

    const accessToken = signAccessToken(cred);
    const refreshToken = await issueRefreshToken(cred.userId);
    return { accessToken, refreshToken };
  },
};
