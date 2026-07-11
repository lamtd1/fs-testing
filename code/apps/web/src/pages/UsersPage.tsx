// Trang admin: danh sách user. Minh hoạ useQuery của TanStack Query với các
// trạng thái isLoading / isError / data — không cần tự quản lý useState/useEffect.
import { useState } from "react";
import { useUsers } from "@/features/users/users.hooks";
import { Card } from "@/components/ui";

export function UsersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useUsers(page);

  if (isLoading) return <p className="text-slate-500">Đang tải danh sách…</p>;
  if (isError) return <p className="text-red-600">Không tải được (bạn có phải admin?)</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Người dùng</h1>
      <Card>
        <table className="w-full text-left text-sm">
          <thead className="border-b text-slate-500">
            <tr>
              <th className="py-2">Tên</th>
              <th>Email</th>
              <th>Vai trò</th>
            </tr>
          </thead>
          <tbody>
            {data!.items.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="py-2">{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Trước
        </button>
        <span className="text-slate-500">
          Trang {data!.pagination.page}/{data!.pagination.totalPages}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= data!.pagination.totalPages}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
