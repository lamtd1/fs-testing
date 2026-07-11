# Tutorial: Xây dựng Hệ thống Website End-to-End Hiện đại

> Từ zero → deploy production với tên miền thật.
> Stack: Express · React · React Router · TanStack Query · Zustand · Zod · TypeScript · Tailwind · Redis · PostgreSQL · Docker
> Kiến trúc: Monolith → Microservices → API Gateway · OAuth · JWT (access/refresh) · RBAC · Message Queue

---

## PHẦN 0 — Nền tảng & Tư duy (Foundations)

- **0.1** Bức tranh tổng thể: request đi từ trình duyệt → DNS → gateway → service → DB như thế nào
- **0.2** Monorepo vs Polyrepo — chọn cấu trúc dự án (dùng pnpm workspaces / Turborepo)
- **0.3** TypeScript config chuẩn cho cả FE + BE (tsconfig base, strict mode, path alias)
- **0.4** Chuẩn hoá môi trường: `.env`, `.nvmrc`, EditorConfig, ESLint, Prettier
- **0.5** Git workflow: branch, conventional commits, pre-commit hooks (husky + lint-staged)

## PHẦN 1 — Backend Nền tảng (Monolith Express trước khi tách microservice)

- **1.1** Khởi tạo Express + TypeScript (tsx/ts-node, cấu trúc thư mục theo layer)
- **1.2** Kiến trúc phân tầng: Controller → Service → Repository
- **1.3** Validation với **Zod** (request DTO, response, env schema)
- **1.4** PostgreSQL: thiết kế schema, chọn ORM (Prisma / Drizzle) + migration
- **1.5** Xử lý lỗi tập trung (error middleware, custom error class, chuẩn response)
- **1.6** Logging (pino) + request tracing (request-id)
- **1.7** Config an toàn: đọc & validate biến môi trường bằng Zod

## PHẦN 2 — Xác thực & Phân quyền (Auth) — *bạn đã biết, ta đào sâu*

- **2.1** JWT đúng cách: access token (ngắn hạn) + refresh token (dài hạn)
- **2.2** Lưu refresh token ở đâu: DB vs **Redis** (revoke, rotation, reuse detection)
- **2.3** Cookie httpOnly vs localStorage — bảo mật XSS/CSRF
- **2.4** **RBAC** chuẩn: roles, permissions, middleware phân quyền, policy-based
- **2.5** Rate limiting & brute-force protection với Redis
- **2.6** Password hashing (argon2/bcrypt), email verification, quên mật khẩu

## PHẦN 3 — OAuth 2.0 & OpenID Connect *(bạn muốn học)*

- **3.1** Hiểu OAuth 2.0: các role (Resource Owner, Client, Auth Server, Resource Server)
- **3.2** Các flow: Authorization Code + PKCE (chuẩn cho web/SPA), vì sao không dùng Implicit nữa
- **3.3** Login với Google/GitHub (bằng thư viện: Passport / Arctic / openid-client)
- **3.4** Liên kết OAuth account với user nội bộ (account linking)
- **3.5** So sánh: tự xây vs dùng Identity Provider (Keycloak, Auth0, Clerk, Logto)
- **3.6** Thực hành: dựng **Keycloak** bằng Docker làm Auth Server

## PHẦN 4 — Frontend Hiện đại (React)

- **4.1** Vite + React + TypeScript + **Tailwind** setup
- **4.2** Routing với **React Router** (data router, loader/action, protected routes)
- **4.3** Server state với **TanStack Query** (query, mutation, cache, invalidation, optimistic update)
- **4.4** Client state với **Zustand** (khi nào dùng, tách khỏi server state)
- **4.5** Validation form với **Zod** + React Hook Form
- **4.6** Chia sẻ type FE↔BE: dùng chung Zod schema / OpenAPI codegen
- **4.7** Gọi API có auth: interceptor, tự động refresh token, xử lý 401
- **4.8** UI patterns: loading/skeleton, error boundary, toast, layout

## PHẦN 5 — Message Queue & Xử lý bất đồng bộ *(bạn đã biết, mở rộng)*

- **5.1** Vì sao cần queue: tách tác vụ nặng khỏi request (gửi mail, xử lý ảnh...)
- **5.2** BullMQ (Redis) cho job trong Node — producer/consumer/worker
- **5.3** RabbitMQ vs Kafka vs Redis Streams — chọn cái nào khi nào
- **5.4** Pattern: retry, dead-letter queue, idempotency
- **5.5** Event-driven giữa các microservice (chuẩn bị cho Phần 6)

## PHẦN 6 — Microservices *(mục tiêu chính bạn muốn học)*

- **6.1** Khi nào KHÔNG nên microservice (và vì sao bắt đầu bằng monolith là đúng)
- **6.2** Tách service theo domain (auth-service, user-service, order-service...)
- **6.3** Giao tiếp giữa service: REST vs gRPC vs message-based
- **6.4** Quản lý dữ liệu: database-per-service, saga, eventual consistency
- **6.5** Service discovery & config tập trung
- **6.6** Distributed tracing (OpenTelemetry + Jaeger), correlation id xuyên service
- **6.7** Xử lý lỗi phân tán: circuit breaker, timeout, retry

## PHẦN 7 — API Gateway *(bạn muốn học)*

- **7.1** Vai trò gateway: routing, auth tập trung, rate limit, aggregation
- **7.2** Lựa chọn: tự viết bằng Express, hay dùng **Kong / Traefik / Nginx / KrakenD**
- **7.3** Xác thực JWT tại gateway (verify 1 lần, truyền context xuống service)
- **7.4** CORS, rate limiting, request/response transform ở gateway
- **7.5** BFF pattern (Backend-for-Frontend)

## PHẦN 8 — Đóng gói với Docker

- **8.1** Dockerfile chuẩn cho Node (multi-stage build, image nhỏ)
- **8.2** Dockerfile cho React (build tĩnh + Nginx serve)
- **8.3** **docker-compose** cho toàn hệ thống local (services + postgres + redis + gateway)
- **8.4** Networking, volumes, healthcheck, biến môi trường
- **8.5** `.dockerignore`, tối ưu layer cache

## PHẦN 9 — Deploy Production Thật *(bạn muốn học)*

- **9.1** Chọn hạ tầng: VPS (DigitalOcean/Vultr/Hetzner) vs PaaS (Railway/Render/Fly.io)
- **9.2** Chuẩn bị VPS: SSH, user, firewall (ufw), fail2ban, swap
- **9.3** Cài Docker + docker-compose trên server
- **9.4** Reverse proxy production: **Nginx / Traefik / Caddy**
- **9.5** **Gán tên miền thật**: mua domain, cấu hình DNS record (A, CNAME), trỏ về VPS
- **9.6** **HTTPS miễn phí** với Let's Encrypt (Certbot / Caddy auto-TLS)
- **9.7** Quản lý secret ở production, không commit `.env`
- **9.8** Zero-downtime deploy & rollback cơ bản

## PHẦN 10 — CI/CD & Vận hành

- **10.1** GitHub Actions: lint → test → build → push image → deploy
- **10.2** Container registry (GHCR / Docker Hub)
- **10.3** Monitoring: healthcheck, uptime, logs tập trung
- **10.4** Backup database định kỳ
- **10.5** (Nâng cao) Giới thiệu Kubernetes — khi nào cần vượt qua docker-compose

## PHẦN 11 — Dự án Thực hành Xuyên suốt (Capstone)

> Một app "Task/Project Management" nhỏ dùng để áp dụng toàn bộ kiến thức trên:
- Auth service (JWT + OAuth Google) · User service · Task service · Notification service (queue)
- API Gateway phía trước · React frontend · Postgres + Redis · Docker Compose · Deploy lên domain thật

---

## Phụ lục

- **A** — Checklist bảo mật (OWASP Top 10 cho web)
- **B** — Sơ đồ kiến trúc (Mermaid) cho từng giai đoạn
- **C** — Danh sách tài liệu học tập (sách, khoá học, docs chính thức)
- **D** — Lộ trình học theo tuần (12 tuần)
