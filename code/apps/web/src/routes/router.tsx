// Khai báo toàn bộ route bằng data router của React Router v6.
// Cấu trúc lồng nhau: RootLayout bọc tất cả; ProtectedRoute/AdminRoute bọc
// các nhánh cần bảo vệ.
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RootLayout } from "./RootLayout";
import { ProtectedRoute, AdminRoute } from "./guards";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { UsersPage } from "@/pages/UsersPage";
import { OAuthCallbackPage } from "@/pages/OAuthCallbackPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // --- Công khai ---
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/auth/callback", element: <OAuthCallbackPage /> },

      // --- Cần đăng nhập ---
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },

          // --- Cần quyền ADMIN ---
          {
            element: <AdminRoute />,
            children: [{ path: "/users", element: <UsersPage /> }],
          },
        ],
      },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
