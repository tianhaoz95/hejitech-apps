import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

const root = __dirname;
const pages = {
  index: "index.html",
  login: "login/index.html",
  pair: "pair/index.html",
  brief: "brief/index.html",
  edition: "edition/index.html",
  preview: "preview/index.html",
  agents: "agents/index.html",
  consent: "oauth/consent/index.html",
  glasses: "glasses/index.html",
  spike: "spike/index.html",
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

/** The development fixture's audio at /fixture/<date>/<file> (the sample edition and the audio spike). */
function fixtureAudio(): Plugin {
  const dir = resolve(root, "../../packages/core/fixtures/2026-10-22/audio");
  return {
    name: "fixture-audio",
    configureServer(server) {
      server.middlewares.use("/fixture/2026-10-22/", (req, res, next) => {
        const file = (req.url ?? "").replace(/^\//, "").split("?")[0];
        if (!/^[a-z0-9-]+\.mp3$/.test(file)) return next();
        res.setHeader("Content-Type", "audio/mpeg");
        res.end(readFileSync(resolve(dir, file)));
      });
    },
    generateBundle() {
      for (const f of readdirSync(dir)) this.emitFile({ type: "asset", fileName: `fixture/2026-10-22/${f}`, source: readFileSync(resolve(dir, f)) });
    },
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
    plugins: [partials(), fixtureAudio()],
    server: { fs: { allow: ["../.."] } },
    build: {
      target: "es2022",
      outDir: "dist",
      rollupOptions: { input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, resolve(root, v)])) },
    },
  };
});
