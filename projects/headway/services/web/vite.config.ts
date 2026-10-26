import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

const root = __dirname;
const pages = {
  index: "index.html",
  login: "login/index.html",
  settings: "settings/index.html",
  consent: "oauth/consent/index.html",
  privacy: "privacy/index.html",
  terms: "terms/index.html",
  support: "support/index.html",
  notFound: "404.html",
};

/** `<!-- @head -->` / `<!-- @header -->` / `<!-- @footer -->` in each page are replaced with the shared partials. */
function partials(): Plugin {
  const read = (name: string) => readFileSync(resolve(root, "src/partials", `${name}.html`), "utf8");
  return {
    name: "partials",
    transformIndexHtml: { order: "pre", handler: (html) => html.replace(/<!-- @(\w+) -->/g, (_, name: string) => read(name)) },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, root), ...process.env };
  // A production build must point at the hosted project, not the local stack.
  if (command === "build" && mode === "production" && !env.WEB_ALLOW_LOCAL) {
    const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].filter((k) => !env[k]);
    if (missing.length) throw new Error(`set ${missing.join(", ")} (see .env.example), or WEB_ALLOW_LOCAL=1 for a local build`);
  }
  return {
    plugins: [partials()],
    server: { fs: { allow: ["../.."] }, proxy: { "/api": "http://127.0.0.1:8792" } },
    build: {
      target: "es2022",
      outDir: "dist",
      rollupOptions: { input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, resolve(root, v)])) },
    },
  };
});
