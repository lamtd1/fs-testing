import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { registerSchema, type RegisterForm } from "@/features/auth/auth.schemas";
import { useRegister } from "@/features/auth/auth.hooks";
import { Field, Button, Card } from "@/components/ui";

export function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const signup = useRegister();

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="mb-4 text-xl font-bold">Đăng ký</h1>
        <form onSubmit={handleSubmit((d) => signup.mutate(d))} className="space-y-4">
          <Field label="Tên" {...register("name")} error={errors.name?.message} />
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
          {signup.isError && (
            <p className="text-sm text-red-600">
              Không đăng ký được (email có thể đã tồn tại)
            </p>
          )}
          <Button type="submit" disabled={signup.isPending}>
            {signup.isPending ? "Đang tạo…" : "Đăng ký"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Đã có tài khoản?{" "}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </Card>
    </div>
  );
}
