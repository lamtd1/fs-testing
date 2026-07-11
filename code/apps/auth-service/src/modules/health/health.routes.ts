import { Router } from "express";
import { asyncHandler } from "@app/shared";
import { prisma } from "../../lib/prisma.js";

export const healthRoutes = Router();

healthRoutes.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service", uptime: process.uptime() });
});

healthRoutes.get(
  "/health/ready",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready", db: "up" });
  }),
);
