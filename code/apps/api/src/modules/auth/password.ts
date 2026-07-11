// Hashing mật khẩu bằng argon2id — thuật toán khuyến nghị hiện nay (thắng Password
// Hashing Competition). Chống brute-force tốt hơn bcrypt nhờ tốn cả bộ nhớ.
// KHÔNG BAO GIỜ lưu mật khẩu dạng plain text.
import argon2 from "argon2";

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
