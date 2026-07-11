# Fullstack Modern — Monorepo

Repo thực hành theo tutorial.
- **Phần 0-1**: setup monorepo + backend Express nền tảng (Controller→Service→Repository, Zod, Prisma, error handling).
- **Phần 2**: Auth — JWT access/refresh, argon2, refresh token rotation + reuse detection (Redis), RBAC.
- **Phần 3**: OAuth 2.0 / OIDC — Authorization Code + PKCE, account linking, chạy được với Google & Keycloak.
- **Phần 4**: Frontend React — Vite + Tailwind, React Router (protected/admin routes), TanStack Query, Zustand, RHF+Zod, axios interceptor tự refresh, silent refresh khi F5.
- **Phần 5**: Message Queue (BullMQ) — gửi email chào mừng nền, worker tiến trình riêng, retry + backoff, dead-letter queue, idempotency.

## Yêu cầu
- Node >= 20 (bạn đang có v25 ✅)
- pnpm (cài: `npm install -g pnpm`)
- Docker (cho Postgres + Redis)

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
pnpm --filter @app/api prisma:migrate    # đặt tên migration: "init"

# 5) (tuỳ chọn) seed dữ liệu mẫu
pnpm --filter @app/api prisma:seed

# 6) Chạy API (hot reload)
pnpm dev
```

API chạy ở `http://localhost:4000`.

## Chạy Frontend (Phần 4)

Mở terminal thứ hai (backend vẫn đang chạy):

```bash
cd code
pnpm --filter @app/web dev
```

Frontend chạy ở `http://localhost:5173` (tự proxy `/api` sang backend :4000).
Đăng nhập thử với `admin@example.com` / `password123` (sau khi đã `prisma:seed`).

## Chạy Worker (Phần 5)

Worker là **tiến trình riêng** xử lý job nền (gửi email chào mừng). Mở terminal thứ ba:

```bash
cd code
pnpm --filter @app/api worker
```

Thử: đăng ký một user mới ở frontend → xem log worker in `📧 Đã gửi email chào mừng`.
Đăng ký email bắt đầu bằng `fail` (vd `fail@test.com`) → xem worker retry 3 lần rồi đẩy vào dead-letter queue.

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

# Danh sách + phân trang (LƯU Ý: giờ cần quyền ADMIN, xem phần Auth)
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

## Thử OAuth / OIDC với Keycloak (Phần 3)

```bash
# Bật Keycloak (đã kèm trong docker-compose, tự import realm "app")
docker compose up -d keycloak
# Admin console: http://localhost:8081  (admin / admin)
# Chờ ~30s cho tới khi discovery sẵn sàng:
curl -s http://localhost:8081/realms/app/.well-known/openid-configuration | head -c 80

# Thêm vào .env:
#   KEYCLOAK_ISSUER=http://localhost:8081/realms/app
#   KEYCLOAK_CLIENT_ID=app-api
#   KEYCLOAK_CLIENT_SECRET=keycloak-client-secret

# Rồi mở TRÌNH DUYỆT tới:
#   http://localhost:4000/api/auth/oauth/keycloak/login
# Đăng nhập bằng user test:  tester / password123
```

Sau khi đăng nhập, backend tạo user (nếu chưa có), set refresh cookie, và redirect về
`FRONTEND_URL/auth/callback?login=success`. Frontend (Phần 4) sẽ gọi `/api/auth/refresh` để lấy access token.

> **Google**: điền `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` vào `.env`, rồi dùng
> `http://localhost:4000/api/auth/oauth/google/login`. Xem `03-Phan-3-OAuth-OIDC.md` mục 3.9.


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
