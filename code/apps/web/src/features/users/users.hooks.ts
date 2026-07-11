// Danh sách user là SERVER STATE -> dùng useQuery (cache, tự refetch, loading...).
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "./users.api";

export function useUsers(page = 1) {
  return useQuery({
    // queryKey là "địa chỉ" của dữ liệu trong cache. Có 'page' nên mỗi trang
    // được cache riêng, đổi trang không mất dữ liệu trang cũ.
    queryKey: ["users", page],
    queryFn: () => usersApi.list(page),
  });
}
