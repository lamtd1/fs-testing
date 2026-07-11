import { api } from "@/lib/api";
import type { User } from "@/types";

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const usersApi = {
  async list(page = 1, limit = 20): Promise<Paginated<User>> {
    const { data } = await api.get<Paginated<User>>("/api/users", {
      params: { page, limit },
    });
    return data;
  },
};
