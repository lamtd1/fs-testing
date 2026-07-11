import { userRepository } from "./user.repository.js";
import { Conflict, NotFound } from "@app/shared";
import type { CreateUserInput, UpdateUserInput } from "@app/shared";

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

  // Tạo profile. Dùng cho cả admin (POST /users) lẫn nội bộ (auth-service gọi khi register).
  async create(input: CreateUserInput & { id?: string }) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw Conflict("Email đã được sử dụng");
    return userRepository.create(input);
  },

  async update(id: string, input: UpdateUserInput) {
    await this.getById(id);
    return userRepository.update(id, input);
  },

  async remove(id: string) {
    await this.getById(id);
    await userRepository.delete(id);
  },
};
