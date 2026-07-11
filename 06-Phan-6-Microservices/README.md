# Phần 6 — Microservices (mục lục)

Từ monolith (Phần 0-5) → microservices đủ bộ. Đọc theo thứ tự; mỗi mục là một commit riêng
để dễ theo dõi diff.

| # | Nội dung | Ý chính |
| --- | --- | --- |
| [6.1](./6.1-Khi-nao-microservice.md) | Khi nào (không) nên microservice | Trade-off, tách theo domain, kiến trúc đích |
| [6.2](./6.2-Tach-service.md) | Tách service + `packages/shared` | auth/user/notification + gateway-lite, DB-per-service |
| [6.2b](./6.2b-OAuth-sang-auth-service.md) | Port OAuth sang auth-service | credential model, account linking |
| [6.3](./6.3-Giao-tiep-correlation-grpc.md) | Giao tiếp giữa service | correlation-id (ALS) + demo gRPC |
| [6.4](./6.4-Saga-eventual-consistency.md) | Saga & eventual consistency | mất transaction → bù trừ, race/idempotency |
| [6.5](./6.5-Service-discovery-config.md) | Service discovery & config | registry, swap sang Consul/k8s |
| [6.6](./6.6-Distributed-tracing.md) | Distributed tracing | OpenTelemetry + Jaeger, span/trace |
| [6.7](./6.7-Resilience.md) | Resilience | timeout, retry, circuit breaker |

Kiến trúc sau Phần 6:

```
Frontend :5173 → gateway :4000 → auth-service :4001 ⇄ user-service :4002 (REST + gRPC :4092)
                                        │                    │
                                     app_auth             app_user
auth-service → Redis(event) → notification-service (worker)
tất cả → OTLP → Jaeger :16686
```
