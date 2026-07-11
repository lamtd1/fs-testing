// Middleware validate request bằng Zod. Truyền schema cho body/query/params.
// Sau khi validate, dữ liệu đã được parse (ép kiểu) gán lại vào req.
import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { BadRequest } from "../utils/errors.js";

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(BadRequest("Dữ liệu không hợp lệ", err.flatten().fieldErrors));
      } else {
        next(err);
      }
    }
  };
}
