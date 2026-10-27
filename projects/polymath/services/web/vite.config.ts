import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

const root = import.meta.dirname;

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, root), ...process.env };
  if (command === "build" && mode === "production" && !env.WEB_ALLOW_LOCAL) {
    const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].filter((k) => !env[k]);
    if (missing.length) throw new Error(`set ${missing.join(", ")}, or WEB_ALLOW_LOCAL=1 for a local build`);
  }
  return {
    server: { fs: { allow: ["../.."] }, proxy: { "/api": "http://127.0.0.1:8797" } },
    build: {
      target: "es2022",
      outDir: "dist",
      rollupOptions: { input: { main: resolve(root, "index.html") } },
    },
  };
});
