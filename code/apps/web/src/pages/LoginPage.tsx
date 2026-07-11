// Trang đăng nhập: form email/mật khẩu (React Hook Form + Zod) + nút OAuth.
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { loginSchema, type LoginForm } from "@/features/auth/auth.schemas";
import { useLogin } from "@/features/auth/auth.hooks";
import { Field, Button, Card } from "@/components/ui";

export function LoginPage() {
  // register/handleSubmit: React Hook Form quản lý giá trị input mà KHÔNG khiến
  // cả form re-render mỗi lần gõ phím (nó dùng uncontrolled input) -> nhanh.
  // zodResolver nối Zod schema vào -> lỗi validate hiện tự động trong formState.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const login = useLogin();

  const onSubmit = (data: LoginForm) => login.mutate(data);

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="mb-4 text-xl font-bold">Đăng nhập</h1>

        {/* handleSubmit tự chặn submit nếu validate fail, chỉ gọi onSubmit khi hợp lệ */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field
            label="Email"
            type="email"
            {...register("email")}
            error={errors.email?.message}
          />
          <Field
            label="Mật khẩu"
            type="password"
            {...register("password")}
            error={errors.password?.message}
          />

          {/* Lỗi từ server (vd sai mật khẩu) nằm trong login.error */}
          {login.isError && (
            <p className="text-sm text-red-600">Email hoặc mật khẩu không đúng</p>
          )}

          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>

        <div className="my-4 text-center text-sm text-slate-400">hoặc</div>

        {/* OAuth là ĐIỀU HƯỚNG CẢ TRANG (không phải fetch) -> dùng thẻ <a>, không
            phải axios. Trình duyệt sẽ đi qua Vite proxy tới backend rồi tới Keycloak. */}
        <a
          href="/api/auth/oauth/keycloak/login"
          className="block w-full rounded-lg border border-slate-300 px-4 py-2 text-center font-medium hover:bg-slate-50"
        >
          Đăng nhập với Keycloak
        </a>

        <p className="mt-4 text-center text-sm text-slate-500">
          Chưa có tài khoản?{" "}
          <Link to="/register" className="text-indigo-600 hover:underline">
            Đăng ký
          </Link>
        </p>
      </Card>
    </div>
  );
}
