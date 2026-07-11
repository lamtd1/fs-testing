import type { Request, Response } from "express";
import { userService } from "./user.service.js";
import type { ListUsersQuery } from "@app/shared";

export const userController = {
  async list(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as ListUsersQuery;
    res.json(await userService.list(page, limit));
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    res.json(await userService.getById(id));
  },

  async create(req: Request, res: Response) {
    const user = await userService.create(req.body);
    res.status(201).json(user);
  },

  async update(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    res.json(await userService.update(id, req.body));
  },

  async remove(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    await userService.remove(id);
    res.status(204).send();
  },
};
