// CONTROLLER: chỉ lo phần HTTP — đọc req, gọi service, trả res.
// KHÔNG chứa business logic. Dữ liệu vào đây đã được validate middleware parse sạch.
import type { Request, Response } from "express";
import { userService } from "./user.service.js";
import type { ListUsersQuery } from "./user.schema.js";

// req.params/req.query đã được middleware validate() parse đúng kiểu,
// nhưng type của Express vẫn chung chung -> ta ép kiểu ở biên controller cho gọn.
export const userController = {
  async list(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as ListUsersQuery;
    const result = await userService.list(page, limit);
    res.json(result);
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const user = await userService.getById(id);
    res.json(user);
  },

  async create(req: Request, res: Response) {
    const user = await userService.create(req.body);
    res.status(201).json(user);
  },

  async update(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const user = await userService.update(id, req.body);
    res.json(user);
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    await userService.remove(id);
    res.status(204).send();
  },
};
