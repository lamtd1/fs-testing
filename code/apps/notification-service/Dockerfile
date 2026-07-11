# ============================================================================
#  notification-service image (KHÔNG có Prisma -> không cần generate/openssl).
#  Là worker: không EXPOSE port, chỉ nối Redis.
# ============================================================================

FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

FROM node:20-slim AS runner
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=builder /repo /repo
WORKDIR /repo/apps/notification-service
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
