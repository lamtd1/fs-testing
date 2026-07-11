import { useAuthStore } from "@/stores/auth.store";
import { Card } from "@/components/ui";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Xin chào, {user?.name} 👋</h1>
      <Card>
        <dl className="grid grid-cols-[100px_1fr] gap-2 text-sm">
          <dt className="text-slate-500">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-slate-500">Vai trò</dt>
          <dd>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-700">
              {user?.role}
            </span>
          </dd>
          <dt className="text-slate-500">ID</dt>
          <dd className="font-mono text-xs">{user?.id}</dd>
        </dl>
      </Card>
      {user?.role === "ADMIN" && (
        <p className="text-sm text-slate-500">
          Bạn là admin — vào mục <b>Users</b> để xem danh sách người dùng.
        </p>
      )}
    </div>
  );
}
