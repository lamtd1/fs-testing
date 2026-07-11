# Fullstack Modern — Monorepo

Repo thực hành theo tutorial. **Trạng thái hiện tại: hết Phần 6 (microservices đầy đủ).**

- **Phần 0-1**: monorepo + backend Express nền tảng.
- **Phần 2**: Auth — JWT access/refresh, argon2, refresh rotation (Redis), RBAC.
- **Phần 3**: OAuth 2.0 / OIDC (Google & Keycloak) — đã port sang auth-service ở 6.2b.
- **Phần 4**: Frontend React.
- **Phần 5**: Message Queue (BullMQ).
- **Phần 6**: Microservices — tách monolith thành **auth-service + user-service + notification-service**,
  `packages/shared`, gateway-lite; REST+gRPC, correlation-id, saga, service registry, tracing
  (OTel+Jaeger), resilience (timeout/retry/circuit breaker). Xem `06-Phan-6-Microservices/`.

## Kiến trúc hiện tại

```
Frontend :5173 ──> gateway :4000 (apps/api) ──> auth-service :4001  ──(REST)──> user-service :4002
                                            └──> user-service :4002
auth-service ──(event welcome email)──> Redis ──> notification-service (worker)
DB: app_auth (auth-service) + app_user (user-service)   — database-per-service
```

## Yêu cầu
- Node >= 20, pnpm, Docker.

## Chạy lần đầu

```bash
cd code
pnpm install

# 1) Tạo .env cho từng service
cp apps/api/.env.example                  apps/api/.env
cp apps/auth-service/.env.example         apps/auth-service/.env
cp apps/user-service/.env.example         apps/user-service/.env
cp apps/notification-service/.env.example apps/notification-service/.env

# 2) Bật Postgres (tự tạo app_auth + app_user) + Redis
pnpm db:up
# (tuỳ chọn) Jaeger để xem distributed tracing: docker compose up -d jaeger  → UI http://localhost:16686

# 3) Migrate + seed cho từng DB
pnpm migrate:auth      # đặt tên migration: "init"
pnpm migrate:user      # đặt tên migration: "init"
pnpm seed:auth
pnpm seed:user

# 4) Chạy tất cả service (song song)
pnpm dev:all
#   hoặc mở nhiều terminal: pnpm dev:auth / dev:user / dev:notif / dev:gateway

# 5) Frontend (terminal khác)
pnpm dev:web
```

Gateway ở `http://localhost:4000` (FE proxy `/api` sang đây — không đổi gì so với Phần 4).

## Thử nhanh

```bash
B=http://localhost:4000

# Đăng ký -> auth-service tạo credential + GỌI user-service tạo profile + phát event email
curl -s -c cookies.txt -X POST $B/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice","password":"secret123"}'
# -> xem log notification-service in "📧 Đã gửi email chào mừng"

# Đăng nhập admin (seed) -> lấy access token
ADMIN=$(curl -s -X POST $B/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r .accessToken)

# /me (auth-service ghép credential + gọi user-service lấy name)
curl -s $B/api/auth/me -H "Authorization: Bearer $ADMIN"

# Danh sách user (gateway -> user-service, cần ADMIN)
curl -s "$B/api/users" -H "Authorization: Bearer $ADMIN"
```

> **OAuth** (Google/Keycloak) đã chạy ở auth-service: mở trình duyệt tới
> `http://localhost:4000/api/auth/oauth/keycloak/login` (qua gateway). Xem 6.2b.

## Cấu trúc (rút gọn)

```
code/
├─ packages/shared/        # @app/shared: errors, logger, validate, auth(JWT), contracts, events
└─ apps/
   ├─ api/                 # gateway-lite (proxy) :4000  — thay ở Phần 7
   ├─ auth-service/        # :4001 · DB app_auth · credential + JWT + refresh(Redis)
   ├─ user-service/        # :4002 · DB app_user · profile CRUD
   ├─ notification-service/# worker · nghe event welcome email
   └─ web/                 # frontend React (Phần 4)
```
