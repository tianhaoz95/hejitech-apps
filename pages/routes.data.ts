// Build-time list of every page on the site (url + title), for the 404 page's "closest pages".
// Reads pages/**/*.md after scripts/pages_sync.mjs has copied each project's docs in.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface Route {
  /** Without the site base, as cleanUrls serves it: "/", "/monorepo", "/waypack/", "/waypack/DEPLOY". */
  url: string;
  title: string;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    if (f.startsWith(".") || f === "public" || f === "node_modules") return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f.endsWith(".md") ? [p] : [];
  });
}

function titleOf(md: string, url: string): string {
  const fm = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const title = fm.match(/^title:\s*"?([^"\n]+)"?/m)?.[1] ?? fm.match(/^\s+name:\s*"?([^"\n]+)"?/m)?.[1] ?? md.match(/^#\s+(.+)$/m)?.[1];
  return (title ?? url).replace(/\s+—.*$/, "").trim();
}

// A plain object (not `defineLoader`): VitePress loads this file as CommonJS, and vitepress is ESM.
export default {
  // Relative to the site root (pages/).
  watch: ["**/*.md"],
  load(): Route[] {
    // `npm run pages:dev` / `pages:build` run from the repo root.
    const pages = join(process.cwd(), "pages");
    return walk(pages)
      .map((file) => {
        const rel = relative(pages, file).replace(/\\/g, "/").replace(/\.md$/, "");
        const url = rel === "index" ? "/" : rel.endsWith("/index") ? `/${rel.slice(0, -5)}` : `/${rel}`;
        return { url, title: titleOf(readFileSync(file, "utf8"), url) };
      })
      .sort((a, b) => a.url.localeCompare(b.url));
  },
};

export declare const data: Route[];
