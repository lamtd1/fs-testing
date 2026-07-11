# Phần 7 — API Gateway (mục lục)

Nâng `apps/api` từ gateway-lite (proxy) ở Phần 6 thành **API Gateway thật**. Mỗi mục một commit.

| # | Nội dung | Ý chính |
| --- | --- | --- |
| [7.1](./7.1-Vai-tro-gateway.md) | Vai trò gateway | single entry point, các mối quan tâm ngang |
| [7.2](./7.2-Tu-viet-vs-cong-cu.md) | Tự viết vs Kong/Traefik/Nginx/KrakenD | khi nào chọn cái nào (+ `reference/`) |
| [7.3](./7.3-Verify-JWT-tai-gateway.md) | Verify JWT tại gateway | verify 1 lần, truyền context, chống giả mạo header |
| [7.4](./7.4-CORS-ratelimit-transform.md) | CORS, rate limit, transform | CORS tập trung, rate limit Redis chống brute-force |
| [7.5](./7.5-BFF-pattern.md) | BFF pattern | gộp nhiều service thành 1 endpoint cho FE |

Pipeline gateway sau Phần 7:

```
helmet → cors → requestId → log → x-gateway
  → rate limit (general + auth) → strip spoof → verify JWT (attachUser)
  → /api/bff (aggregation) | requireAuth | proxy (+ inject x-user-* + x-gateway-token)
        ├─ /api/auth  → auth-service
        └─ /api/users → user-service
```
