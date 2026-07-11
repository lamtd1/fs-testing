import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const healthRoutes = Router();

// Liveness: app còn sống không
healthRoutes.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Readiness: có kết nối được DB không (dùng cho load balancer / k8s sau này)
healthRoutes.get(
  "/health/ready",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready", db: "up" });
  }),
);
