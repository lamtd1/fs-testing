# Phần 8 — Đóng gói với Docker (mục lục)

Đóng gói toàn hệ thống thành image + dựng bằng một lệnh. ✅ Đã **build-verified** và **chạy thật** end-to-end.

| # | Nội dung | Ý chính |
| --- | --- | --- |
| [8.1](./8.1-Dockerfile-node.md) | Dockerfile Node service | multi-stage, node:20-slim, generate Prisma trong image, chạy tsx |
| [8.2](./8.2-Dockerfile-react.md) | Dockerfile React | build tĩnh Vite + Nginx serve (SPA fallback, proxy /api) |
| [8.3-8.4](./8.3-8.4-compose-fullstack.md) | docker-compose full-stack | networking theo tên service, healthcheck, init db push+seed, env |
| [8.5](./8.5-dockerignore-cache.md) | .dockerignore & layer cache | build nhanh, image nhỏ (bundler) |

## Chạy toàn hệ thống

```bash
cd code
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d --build
# Web:     http://localhost:8080
# Gateway: http://localhost:4000
```

```
web(:8080 nginx) → gateway(:4000) → auth-service(:4001) ⇄ user-service(:4002, gRPC :4092)
                                          │                     │
                                       app_auth             app_user   (Postgres)
auth-service → Redis(event) → notification-service (worker)
tất cả → OTLP → Jaeger(:16686)
```
