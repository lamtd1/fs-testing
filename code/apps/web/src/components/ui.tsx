// Vài component UI nhỏ dùng lại (input, nút, thẻ). Giữ tối giản với Tailwind.
import { forwardRef } from "react";
import type { InputHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

// QUAN TRỌNG: phải dùng forwardRef. React Hook Form (register) truyền một `ref`
// vào để ĐỌC giá trị input. Nếu Field là function component thường, `ref` bị
// React nuốt mất -> RHF không thấy giá trị -> báo "Required" dù đã gõ.
// forwardRef chuyển tiếp ref đó xuống thẳng thẻ <input>.
export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
>(({ label, error, ...props }, ref) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
    <input
      ref={ref}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      {...props}
    />
    {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
  </label>
));
Field.displayName = "Field";

export function Button({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">{children}</div>
  );
}
