# ============================================================================
#  Frontend React: BUILD tĩnh (Vite) rồi để NGINX phục vụ file tĩnh.
#  Ảnh cuối chỉ là nginx + thư mục dist -> RẤT NHỎ (không có Node ở runtime).
# ============================================================================

# ---- builder: vite build -> apps/web/dist ----
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @app/web build

# ---- runner: chỉ Nginx + file tĩnh ----
FROM nginx:1.27-alpine AS runner
# Cấu hình proxy /api + SPA fallback.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# Chỉ mang KẾT QUẢ build (không mang Node/pnpm/source) -> ảnh nhỏ.
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
