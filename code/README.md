# Fullstack Modern — Monorepo

Repo thực hành theo tutorial. **Trạng thái hiện tại: hết Phần 2.**

- **Phần 0-1**: setup monorepo + backend Express nền tảng (Controller→Service→Repository, Zod, Prisma, error handling).
- **Phần 2**: Auth — JWT access/refresh, argon2, refresh token rotation + reuse detection (Redis), RBAC.

> Các phần sau (OAuth, Frontend, Message Queue...) sẽ được thêm dần trong các commit tiếp theo.

## Yêu cầu
- Node >= 20 (bạn đang có v25 ✅)
- pnpm (cài: `npm install -g pnpm`)
- Docker (cho PostgreSQL + Redis)

## Chạy lần đầu

```bash
cd code

# 1) Cài dependencies cho toàn workspace
pnpm install

# 2) Tạo file .env từ mẫu
cp .env.example .env

# 3) Bật Postgres + Redis bằng Docker
pnpm db:up

# 4) Tạo bảng trong DB (chạy migration Prisma)
pnpm --filter @app/api prisma:migrate

# 5) (tuỳ chọn) seed dữ liệu mẫu
pnpm --filter @app/api prisma:seed

# 6) Chạy API (hot reload)
pnpm dev
```

API chạy ở `http://localhost:4000`.

## Thử API

```bash
# Health
curl http://localhost:4000/api/health
curl http://localhost:4000/api/health/ready

# Danh sách user (LƯU Ý: giờ cần quyền ADMIN, xem phần Auth)
curl "http://localhost:4000/api/users?page=1&limit=10"
```

## Thử Auth (Phần 2)

Sau khi `prisma:seed`, có sẵn: `admin@example.com` (ADMIN) và `user@example.com` (USER), mật khẩu `password123`.

```bash
B=http://localhost:4000

# Đăng ký (nhận accessToken trong body + refresh_token trong httpOnly cookie)
curl -s -c cookies.txt -X POST $B/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice","password":"secret123"}'

# Đăng nhập admin, lấy access token
ADMIN=$(curl -s -X POST $B/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r .accessToken)

# Route cần đăng nhập
curl -s $B/api/auth/me -H "Authorization: Bearer $ADMIN"

# RBAC: chỉ ADMIN mới xem được danh sách user
curl -s $B/api/users -H "Authorization: Bearer $ADMIN"

# Refresh (dùng cookie) -> access token mới + xoay refresh token
curl -s -b cookies.txt -c cookies.txt -X POST $B/api/auth/refresh

# Logout -> thu hồi refresh token + xoá cookie
curl -s -b cookies.txt -c cookies.txt -X POST $B/api/auth/logout
```

## Cấu trúc

```
code/
├─ package.json            # scripts toàn workspace
├─ pnpm-workspace.yaml     # khai báo workspaces
├─ tsconfig.base.json      # TS config dùng chung (strict)
├─ docker-compose.yml      # postgres + redis (local)
├─ .env.example
└─ apps/
   └─ api/
      ├─ prisma/schema.prisma   # định nghĩa DB (User + Role)
      └─ src/
         ├─ index.ts            # khởi động server
         ├─ app.ts              # ráp middleware + routes
         ├─ config/env.ts       # validate ENV bằng Zod
         ├─ lib/                # logger, prisma client, redis
         ├─ middleware/         # requestId, validate, errorHandler, authenticate, authorize
         ├─ utils/              # AppError, asyncHandler
         └─ modules/            # theo domain
            ├─ health/
            ├─ user/            # routes → controller → service → repository
            └─ auth/            # register/login/refresh/logout, JWT, RBAC
```
