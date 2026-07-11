# ============================================================================
#  auth-service image (giống user-service — có Prisma nên generate trong image).
#  Build context = thư mục code/. Chạy production bằng tsx.
# ============================================================================

# ---- builder: cài dependencies + generate Prisma client ----
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @app/auth-service exec prisma generate

# ---- runner ----
FROM node:20-slim AS runner
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=builder /repo /repo
WORKDIR /repo/apps/auth-service
EXPOSE 4001
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
