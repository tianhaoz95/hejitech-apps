#!/usr/bin/env node
// Builds the GitHub Pages source tree: copies every project's docs (projects/<p>/docs) into
// pages/<p>/ and their public assets into pages/public/<p>/, so each project keeps its docs in its
// own folder while the site (pages/, VitePress) covers every HEJI app. Run by `npm run pages:dev`
// and `npm run pages:build`; the copies are git-ignored.
//
// Project docs are written as if their folder were the site root: links like `/design` or a hero
// `link: /DEPLOY` are rewritten to `/<p>/design`. Optional projects/<p>/docs/pages.json:
//   { "static": { "<path under /<p>/>": "<dir relative to docs/>" } }   publishes a static site as-is
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = join(root, "pages");

/** Rewrites root-absolute links in a project's markdown to its section of the site. */
export function rewriteLinks(md, project) {
  const fix = (url) => (url.startsWith("/") && !url.startsWith("//") && !url.startsWith(`/${project}/`) ? `/${project}${url}` : url);
  return md
    .replace(/\]\((\/[^)\s]*)\)/g, (_, url) => `](${fix(url)})`)
    .replace(/^(\s*-?\s*link:\s*)(\/\S*)\s*$/gm, (_, pre, url) => `${pre}${fix(url)}`)
    .replace(/(href=")(\/[^"]*)"/g, (_, pre, url) => `${pre}${fix(url)}"`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === ".vitepress" || f === "public" || f === "node_modules") return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function sync() {
  const projects = readdirSync(join(root, "projects")).filter((p) => existsSync(join(root, "projects", p, "docs")));
  for (const p of projects) {
    const src = join(root, "projects", p, "docs");
    if (!existsSync(join(src, "index.md"))) throw new Error(`projects/${p}/docs/index.md is missing (the section's landing page)`);
    const out = join(pages, p);
    rmSync(out, { recursive: true, force: true });
    for (const file of walk(src)) {
      const rel = relative(src, file);
      const dest = join(out, rel);
      mkdirSync(dirname(dest), { recursive: true });
      if (file.endsWith(".md")) writeFileSync(dest, rewriteLinks(readFileSync(file, "utf8"), p));
      else if (!rel.endsWith("pages.json")) cpSync(file, dest);
    }
    const pub = join(pages, "public", p);
    rmSync(pub, { recursive: true, force: true });
    if (existsSync(join(src, "public"))) cpSync(join(src, "public"), pub, { recursive: true });
    const extra = join(src, "pages.json");
    if (existsSync(extra)) {
      for (const [at, from] of Object.entries(JSON.parse(readFileSync(extra, "utf8")).static ?? {})) {
        cpSync(join(src, from), join(pub, at), { recursive: true });
      }
    }
  }
  return projects;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`pages/: synced docs of ${sync().join(", ")}`);
}
