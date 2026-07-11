import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // PROXY: chuyển mọi request /api sang backend (localhost:4000).
    // Nhờ đó frontend gọi API bằng đường dẫn TƯƠNG ĐỐI ("/api/...") -> cùng
    // origin với trang -> KHÔNG dính CORS, cookie là first-party. Đây cũng
    // giống production (Phần 9): frontend + API sau cùng một domain.
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
