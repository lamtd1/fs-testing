// Hooks đóng gói logic auth cho component. Dùng useMutation của TanStack Query
// cho các hành động (login/register/logout) vì chúng là "thao tác thay đổi".
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authApi } from "./auth.api";
import { useAuthStore } from "@/stores/auth.store";
import { queryClient } from "@/lib/queryClient";

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Lưu access token + user vào store -> cả app biết đã đăng nhập.
      setAuth(data.accessToken, data.user);
      navigate("/dashboard");
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
      navigate("/dashboard");
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.logout,
    // Dù server lỗi hay không, phía client vẫn phải "quên" mình đi.
    onSettled: () => {
      clear();
      queryClient.clear(); // xoá mọi cache server-state của user cũ
      navigate("/login");
    },
  });
}
