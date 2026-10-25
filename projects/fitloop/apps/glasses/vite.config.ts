import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths: the Even app serves the packed folder from its own origin.
  base: "./",
  server: { fs: { allow: ["../.."] } },
  build: { target: "es2022", outDir: "dist" },
});
