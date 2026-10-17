import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served by the Contempo Worker under /admin/ (services/web/src/worker/index.ts).
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
});
