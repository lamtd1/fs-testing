# Fullstack Modern — Monorepo

Repo thực hành theo tutorial. **Trạng thái hiện tại: hết Phần 0-1.**

- **Phần 0-1**: setup monorepo (pnpm workspaces) + backend Express nền tảng
  (Controller→Service→Repository, Zod validation, Prisma/PostgreSQL, error handling tập trung, logging pino, request-id).

> Các phần sau (Auth, OAuth, Frontend, Message Queue...) sẽ được thêm dần trong các commit tiếp theo.

## Yêu cầu
- Node >= 20 (bạn đang có v25 ✅)
- pnpm (cài: `npm install -g pnpm`)
- Docker (cho PostgreSQL)

## Chạy lần đầu

```bash
cd code

# 1) Cài dependencies cho toàn workspace
pnpm install

# 2) Tạo file .env từ mẫu
cp .env.example .env

# 3) Bật PostgreSQL bằng Docker
pnpm db:up

# 4) Tạo bảng trong DB (chạy migration Prisma)
pnpm --filter @app/api prisma:migrate    # đặt tên migration: "init"

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

# Tạo user (validate bằng Zod)
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test"}'

# Thử gửi email sai -> nhận lỗi 400 có chi tiết field
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"khong-phai-email","name":""}'

# Danh sách + phân trang
curl "http://localhost:4000/api/users?page=1&limit=10"
```

## Cấu trúc

```
code/
├─ package.json            # scripts toàn workspace
├─ pnpm-workspace.yaml     # khai báo workspaces
├─ tsconfig.base.json      # TS config dùng chung (strict)
├─ docker-compose.yml      # postgres (local)
├─ .env.example
└─ apps/
   └─ api/
      ├─ prisma/schema.prisma   # định nghĩa DB
      └─ src/
         ├─ index.ts            # khởi động server
         ├─ app.ts              # ráp middleware + routes
         ├─ config/env.ts       # validate ENV bằng Zod
         ├─ lib/                # logger, prisma client
         ├─ middleware/         # requestId, validate, errorHandler
         ├─ utils/              # AppError, asyncHandler
         └─ modules/            # theo domain
            ├─ health/
            └─ user/            # routes → controller → service → repository
```
