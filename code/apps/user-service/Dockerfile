# ============================================================================
#  user-service image (build context = thư mục code/ để thấy packages/shared + lock)
#  Chạy production bằng tsx: @app/shared là TS-source import trực tiếp nên biên dịch
#  tsc riêng lẻ sẽ vướng; tsx né được (đổi lại chậm khởi động chút — 8.5 bàn cách
#  tối ưu bằng bundler). Prisma client GENERATE TRONG image -> đúng engine Linux.
# ============================================================================

# ---- builder: cài dependencies + generate Prisma client ----
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
# openssl: Prisma engine cần libssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @app/user-service exec prisma generate

# ---- runner ----
FROM node:20-slim AS runner
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=builder /repo /repo
WORKDIR /repo/apps/user-service
EXPOSE 4002
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
