# Fullstack Modern — Monorepo

Repo thực hành theo tutorial. **Trạng thái hiện tại: hết Phần 4.**

- **Phần 0-1**: setup monorepo + backend Express nền tảng (Controller→Service→Repository, Zod, Prisma, error handling).
- **Phần 2**: Auth — JWT access/refresh, argon2, refresh token rotation + reuse detection (Redis), RBAC.
- **Phần 3**: OAuth 2.0 / OIDC — Authorization Code + PKCE, account linking, chạy được với Google & Keycloak.
- **Phần 4**: Frontend React — Vite + Tailwind, React Router (protected/admin routes), TanStack Query, Zustand, RHF+Zod, axios interceptor tự refresh, silent refresh khi F5.

> Các phần sau (Message Queue...) sẽ được thêm dần trong các commit tiếp theo.

## Yêu cầu
- Node >= 20 (bạn đang có v25 ✅)
- pnpm (cài: `npm install -g pnpm`)
- Docker (cho Postgres + Redis + Keycloak)

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

## Chạy Frontend (Phần 4)

Mở terminal thứ hai (backend vẫn đang chạy):

```bash
cd code
pnpm --filter @app/web dev   # hoặc: pnpm dev:web
```

Frontend chạy ở `http://localhost:5173` (tự proxy `/api` sang backend :4000).
Đăng nhập thử với `admin@example.com` / `password123` (sau khi đã `prisma:seed`).

## Thử Auth (Phần 2)

Sau khi `prisma:seed`, có sẵn: `admin@example.com` (ADMIN) và `user@example.com` (USER), mật khẩu `password123`.

```bash
B=http://localhost:4000

# Đăng nhập admin, lấy access token
ADMIN=$(curl -s -X POST $B/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r .accessToken)

# Route cần đăng nhập
curl -s $B/api/auth/me -H "Authorization: Bearer $ADMIN"

# RBAC: chỉ ADMIN mới xem được danh sách user
curl -s $B/api/users -H "Authorization: Bearer $ADMIN"
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
`FRONTEND_URL/auth/callback?login=success`.

> **Google**: điền `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` vào `.env`, rồi dùng
> `http://localhost:4000/api/auth/oauth/google/login`. Xem `03-Phan-3-OAuth-OIDC.md`.

## Cấu trúc

```
code/
├─ docker-compose.yml      # postgres + redis + keycloak (local)
├─ keycloak/               # realm import cho Keycloak
└─ apps/
   └─ api/
      ├─ prisma/schema.prisma   # User + Role + OAuthAccount
      └─ src/
         ├─ config/env.ts
         ├─ lib/                # logger, prisma, redis
         ├─ middleware/         # requestId, validate, errorHandler, authenticate, authorize
         └─ modules/
            ├─ health/
            ├─ user/
            └─ auth/            # JWT, RBAC
               └─ oauth/        # Authorization Code + PKCE, account linking
```
