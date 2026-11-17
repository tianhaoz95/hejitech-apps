#!/usr/bin/env node
// Builds the Chrome extension into dist/ (load it unpacked from there) and, with --zip, packs
// icecap-extension-<version>.zip (the Chrome Web Store upload: no `key`, the store assigns the id) and
// icecap-extension-<version>-sideload.zip (with the key: the same id as unpacked builds).
//
//   node scripts/build.mjs                     production build
//   node scripts/build.mjs --dev [--watch]     the local stack (supabase start + the Worker on :8800)
//   node scripts/build.mjs --zip               production build + zip
//
// Three Vite builds: the React pages (side panel, popup, options) and the background service worker
// as ES modules, then each content script as one classic IIFE file (content scripts can't import).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { CONTENT_SCRIPTS, manifest } from "../manifest.config.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const dev = process.argv.includes("--dev");
const watch = process.argv.includes("--watch") ? {} : null;
const mode = dev ? "development" : "production";
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

rmSync(dist, { recursive: true, force: true });
// dedupe: other projects keep React 18 at the repo root, where hoisted libraries (lucide, zustand,
// react-markdown) would otherwise pick it up next to the extension's React 19.
const common = { configFile: false, mode, logLevel: "warn", resolve: { dedupe: ["react", "react-dom"] }, define: { "process.env.NODE_ENV": JSON.stringify(mode) } };

await build({
  ...common,
  root: resolve(root, "src/pages"),
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: dist,
    emptyOutDir: false,
    target: "chrome120",
    sourcemap: dev,
    minify: !dev,
    watch,
    rollupOptions: {
      input: {
        sidepanel: resolve(root, "src/pages/sidepanel.html"),
        popup: resolve(root, "src/pages/popup.html"),
        options: resolve(root, "src/pages/options.html"),
        background: resolve(root, "src/background.ts"),
      },
      output: { entryFileNames: (c) => (c.name === "background" ? "background.js" : "assets/[name]-[hash].js") },
    },
  },
});

for (const site of Object.keys(CONTENT_SCRIPTS)) {
  await build({
    ...common,
    build: {
      outDir: resolve(dist, "contents"),
      emptyOutDir: false,
      target: "chrome120",
      minify: !dev,
      watch,
      lib: { entry: resolve(root, `src/contents/${site}.ts`), formats: ["iife"], name: `icecap_${site}`, fileName: () => `${site}.js` },
    },
  });
}

mkdirSync(dist, { recursive: true });
for (const s of [16, 32, 48]) cpSync(resolve(root, `assets/icon${s}.png`), resolve(dist, `icon${s}.png`));
cpSync(resolve(root, "assets/icon.png"), resolve(dist, "icon128.png"));
writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest({ version, dev }), null, 2) + "\n");
console.log(`icecap extension ${version} (${mode}) → ${dist}`);

if (process.argv.includes("--zip")) {
  const pack = (name) => {
    const zip = resolve(root, name);
    rmSync(zip, { force: true });
    execFileSync("zip", ["-qr", "-X", zip, "."], { cwd: dist });
    console.log(`packed ${zip}`);
  };
  pack(`icecap-extension-${version}-sideload.zip`);
  writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest({ version, dev, store: true }), null, 2) + "\n");
  pack(`icecap-extension-${version}.zip`);
  // Leave dist/ loadable unpacked, with the pinned id.
  writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest({ version, dev }), null, 2) + "\n");
}
