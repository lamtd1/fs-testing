// Entry point: gắn các Provider toàn cục rồi render router.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { router } from "@/routes/router";
import "@/lib/api"; // import để đăng ký interceptor (side-effect)
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* QueryClientProvider: cho toàn app dùng chung 1 cache của TanStack Query */}
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
