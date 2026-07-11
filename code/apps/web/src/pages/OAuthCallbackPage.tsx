// Trang này là nơi backend redirect về sau khi đăng nhập OAuth xong
// (FRONTEND_URL/auth/callback). Refresh token đã nằm trong cookie; việc của ta
// chỉ là gọi /refresh để lấy access token + /me lấy profile, rồi vào dashboard.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/features/auth/auth.api";
import { useAuthStore } from "@/stores/auth.store";

export function OAuthCallbackPage() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { accessToken } = await authApi.refresh();
        const { user } = await authApi.me();
        setAuth(accessToken, user);
        navigate("/dashboard", { replace: true });
      } catch {
        navigate("/login?oauth_error=1", { replace: true });
      }
    })();
  }, [setAuth, navigate]);

  return <p className="text-slate-500">Đang hoàn tất đăng nhập…</p>;
}
