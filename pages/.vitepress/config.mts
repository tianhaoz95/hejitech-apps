// The HEJI apps site (GitHub Pages: https://tianhaoz95.github.io/hejitech-apps/). The home page and
// the monorepo guide live here; each project's docs live in projects/<p>/docs and are copied into
// pages/<p>/ by scripts/pages_sync.mjs (run before dev/build). A project's sidebar comes from its
// docs/pages.json ("sidebar"), else from its pages' first headings.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type DefaultTheme } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const root = join(__dirname, "../..");
const base = "/hejitech-apps/";

interface ProjectPages {
  name: string;
  sidebar?: DefaultTheme.SidebarItem[];
}

const projects = readdirSync(join(root, "projects")).filter((p) => existsSync(join(root, "projects", p, "docs", "index.md")) && !existsSync(join(root, "projects", p, "docs", ".vitepress")));

function pagesJson(p: string): ProjectPages {
  const f = join(root, "projects", p, "docs", "pages.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { name: p };
}

/** Explicit sidebar from pages.json (links relative to the section), plus any page it doesn't list. */
function sidebarFor(p: string): DefaultTheme.SidebarItem[] {
  const dir = join(root, "projects", p, "docs");
  const cfg = pagesJson(p);
  const prefix = (link: string) => `/${p}/${link.replace(/^\//, "")}`;
  const groups = (cfg.sidebar ?? []).map((g) => ({ ...g, items: g.items?.map((i) => ({ ...i, link: prefix(i.link ?? "") })) }));
  const listed = new Set(groups.flatMap((g) => g.items ?? []).map((i) => (i.link === `/${p}/` ? "index" : i.link!.slice(p.length + 2))));
  const rest = readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !listed.has(f.replace(/\.md$/, "")))
    .map((f) => {
      const md = readFileSync(join(dir, f), "utf8");
      const title = md.match(/^#\s+(.+)$/m)?.[1] ?? md.match(/^\s+name:\s*"?([^"\n]+)"?/m)?.[1] ?? f;
      return { text: title.replace(/\s+—.*$/, ""), link: f === "index.md" ? `/${p}/` : `/${p}/${f.replace(/\.md$/, "")}` };
    });
  return rest.length ? [...groups, { text: groups.length ? "More" : cfg.name, items: rest }] : groups;
}

export default withMermaid(
  defineConfig({
    title: "HEJI Apps",
    description: "Small, focused apps by HEJI Technology: Waypack, Wee Hours and what comes next.",
    base,
    cleanUrls: true,
    head: [
      ["link", { rel: "icon", href: `${base}heji.svg`, type: "image/svg+xml" }],
      ["meta", { name: "theme-color", content: "#2f5bea" }],
    ],
    themeConfig: {
      logo: "/heji.svg",
      siteTitle: "HEJI Apps",
      nav: [
        { text: "Apps", link: "/#apps" },
        ...projects.map((p) => ({ text: pagesJson(p).name, link: `/${p}/`, activeMatch: `^/${p}/` })),
        // Its own VitePress site, built into /feedbackkit/ by pages.yml: a full page load, not a route.
        { text: "FeedbackKit", link: "https://tianhaoz95.github.io/hejitech-apps/feedbackkit/", target: "_self" },
        { text: "Monorepo", link: "/monorepo" },
      ],
      sidebar: Object.fromEntries(projects.map((p) => [`/${p}/`, sidebarFor(p)])),
      socialLinks: [{ icon: "github", link: "https://github.com/tianhaoz95/hejitech-apps" }],
      search: { provider: "local" },
      outline: { level: [2, 3] },
      footer: {
        message: "Source available under the PolyForm Perimeter License 1.0.1.",
        copyright: "Copyright © 2026 Tianhao Zhou · HEJI Technology LLC",
      },
    },
  }),
);
