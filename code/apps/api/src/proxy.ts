// Factory tạo proxy tới một service, có INJECT context xuống service đích.
import type { Request } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { IncomingMessage } from "node:http";
import {
  USER_ID_HEADER,
  USER_EMAIL_HEADER,
  USER_ROLE_HEADER,
  GATEWAY_TOKEN_HEADER,
} from "@app/shared";
import { env } from "./config/env.js";

// prefix: "/api/auth" | "/api/users". Giữ nguyên path khi chuyển tiếp.
export function serviceProxy(target: string, prefix: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { "^/": `${prefix}/` },
    on: {
      proxyReq: (proxyReq, req: IncomingMessage) => {
        // "Bằng chứng" request đến từ gateway (service kiểm secret này trước khi
        // tin x-user-*). Luôn gắn cho MỌI request đã qua gateway.
        proxyReq.setHeader(GATEWAY_TOKEN_HEADER, env.GATEWAY_SECRET);

        // Nếu đã verify được người dùng -> truyền danh tính xuống service.
        const user = (req as Request).user;
        if (user) {
          proxyReq.setHeader(USER_ID_HEADER, user.sub);
          proxyReq.setHeader(USER_ROLE_HEADER, user.role);
          proxyReq.setHeader(USER_EMAIL_HEADER, user.email);
        }
      },
    },
  });
}
