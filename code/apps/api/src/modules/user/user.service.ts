// SERVICE: chứa business logic. Không biết gì về HTTP (req/res),
// không truy vấn DB trực tiếp -> gọi repository. Dễ test, dễ tái dùng.
import { userRepository } from "./user.repository.js";
import { Conflict, NotFound } from "../../utils/errors.js";
import type { CreateUserInput, UpdateUserInput } from "./user.schema.js";

export const userService = {
  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await userRepository.findMany(skip, limit);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw NotFound("Người dùng không tồn tại");
    return user;
  },

  async create(input: CreateUserInput) {
    // Business rule: email không được trùng.
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw Conflict("Email đã được sử dụng");
    return userRepository.create(input);
  },

  async update(id: string, input: UpdateUserInput) {
    await this.getById(id); // đảm bảo tồn tại (ném 404 nếu không)
    return userRepository.update(id, input);
  },

  async remove(id: string) {
    await this.getById(id);
    await userRepository.delete(id);
  },
};
