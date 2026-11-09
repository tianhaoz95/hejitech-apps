import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = __dirname;

export default defineConfig({
  server: { fs: { allow: ["../.."] }, proxy: { "/api": "http://127.0.0.1:8799" } },
  build: {
    target: "es2022",
    outDir: "dist",
    rollupOptions: { input: { index: resolve(root, "index.html"), consent: resolve(root, "oauth/consent/index.html") } },
  },
});
