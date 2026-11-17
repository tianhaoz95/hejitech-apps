import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = __dirname;
// One build for every page the Worker serves (src/worker/index.ts maps /app/* and /admin/* back to
// their index.html so the React routers handle deep links).
const pages = {
  home: "index.html",
  app: "app/index.html",
  admin: "admin/index.html",
  privacy: "privacy/index.html",
  terms: "terms/index.html",
  promo: "promo/index.html",
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: ["../.."] } },
  build: {
    target: "es2022",
    outDir: "dist",
    rollupOptions: { input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, resolve(root, v)])) },
  },
});
