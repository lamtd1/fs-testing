// Gán mỗi request một id duy nhất -> dễ trace log, và về sau truyền xuyên microservice.
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  req.id = incoming ?? randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
}
