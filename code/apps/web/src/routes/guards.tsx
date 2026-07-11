// Route guards: bảo vệ các route cần đăng nhập / cần quyền admin.
// Dùng <Outlet/> nên có thể bọc NHIỀU route con cùng lúc trong router.
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";

// Cần đăng nhập. Chưa đăng nhập -> đá về /login.
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Cần role ADMIN. (Đây chỉ là bảo vệ Ở UI cho gọn — backend VẪN kiểm tra quyền
// thật; frontend không bao giờ là nơi bảo mật thật sự.)
export function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
