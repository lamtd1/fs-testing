import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-2 text-slate-500">Không tìm thấy trang.</p>
      <Link to="/" className="mt-4 inline-block text-indigo-600 hover:underline">
        Về trang chủ
      </Link>
    </div>
  );
}
