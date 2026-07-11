import { QueryClient } from "@tanstack/react-query";

// Cấu hình mặc định cho TanStack Query.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Coi dữ liệu là "còn tươi" trong 30s -> không refetch lung tung.
      staleTime: 30_000,
      // 401 đã được axios interceptor tự xử lý (refresh). Ở đây không retry
      // để tránh nhân đôi request khi lỗi thật.
      retry: 1,
    },
  },
});
