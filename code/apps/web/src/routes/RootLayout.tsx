// Layout gốc: (1) chạy "silent refresh" MỘT LẦN khi app khởi động để khôi phục
// phiên sau khi F5, (2) hiện thanh điều hướng, (3) render route con qua <Outlet/>.
import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { authApi } from "@/features/auth/auth.api";
import { useLogout } from "@/features/auth/auth.hooks";

// Cờ MODULE-LEVEL (ngoài component) để bootstrap chỉ chạy ĐÚNG MỘT LẦN.
// Vì sao cần? React StrictMode (dev) cố tình mount→unmount→mount lại, khiến
// useEffect chạy 2 lần. Nếu gọi /refresh 2 lần gần như đồng thời, lần thứ hai
// dùng refresh token đã bị lần đầu xoay đi -> backend tưởng bị REUSE -> thu hồi
// cả phiên -> user bị đá ra oan. Cờ này nằm ngoài React nên sống sót qua lần
// remount của StrictMode -> chỉ refresh một lần.
let didBootstrap = false;

export function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const clear = useAuthStore((s) => s.clear);

  // --- Silent refresh khi tải trang ---
  // Access token chỉ ở trong bộ nhớ nên F5 là mất. Nhưng refresh token vẫn nằm
  // trong httpOnly cookie -> ta gọi /refresh để lấy access token mới, rồi /me
  // để lấy profile.
  useEffect(() => {
    if (didBootstrap) return;
    didBootstrap = true;
    (async () => {
      try {
        const { accessToken } = await authApi.refresh();
        // Set token TRƯỚC khi gọi /me, nếu không /me sẽ bị 401 (thiếu token) và
        // interceptor sẽ tự refresh lần nữa -> vừa thừa, vừa gây trạng thái nửa vời.
        setAccessToken(accessToken);
        const { user } = await authApi.me();
        setAuth(accessToken, user); // giờ mới lật status -> authenticated (kèm user)
      } catch {
        clear(); // không có phiên hợp lệ -> coi như chưa đăng nhập
      }
    })();
  }, [setAuth, setAccessToken, clear]);

  // Trong lúc chưa biết đã đăng nhập hay chưa -> hiện splash, tránh "nháy" trang login.
  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">
        Đang tải…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto max-w-4xl p-6">
        <Outlet />
      </main>
    </div>
  );
}

function Navbar() {
  const { status, user } = useAuthStore();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between p-4">
        <button
          onClick={() => navigate("/")}
          className="text-lg font-bold text-indigo-600"
        >
          Fullstack Modern
        </button>

        {status === "authenticated" ? (
          <div className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="hover:text-indigo-600">
              Dashboard
            </Link>
            {user?.role === "ADMIN" && (
              <Link to="/users" className="hover:text-indigo-600">
                Users
              </Link>
            )}
            <span className="text-slate-500">{user?.email}</span>
            <button
              onClick={() => logout.mutate()}
              className="rounded bg-slate-100 px-3 py-1 hover:bg-slate-200"
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          <Link to="/login" className="text-sm hover:text-indigo-600">
            Đăng nhập
          </Link>
        )}
      </nav>
    </header>
  );
}
