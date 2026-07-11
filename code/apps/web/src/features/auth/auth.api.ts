// Lớp gọi API auth — chỉ là các hàm mỏng bọc axios. Tách riêng để hook và
// component không dính chi tiết URL/response.
import { api } from "@/lib/api";
import type { User } from "@/types";
import type { LoginForm, RegisterForm } from "./auth.schemas";

interface AuthResponse {
  user: User;
  accessToken: string;
}

export const authApi = {
  async login(body: LoginForm): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/api/auth/login", body);
    return data;
  },
  async register(body: RegisterForm): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/api/auth/register", body);
    return data;
  },
  async me(): Promise<{ user: User }> {
    const { data } = await api.get<{ user: User }>("/api/auth/me");
    return data;
  },
  async refresh(): Promise<{ accessToken: string }> {
    const { data } = await api.post<{ accessToken: string }>("/api/auth/refresh");
    return data;
  },
  async logout(): Promise<void> {
    await api.post("/api/auth/logout");
  },
};
