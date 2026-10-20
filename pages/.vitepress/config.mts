// The HEJI apps site (GitHub Pages: https://tianhaoz95.github.io/hejitech-apps/). The home page and
// the monorepo guide live here; each project's docs live in projects/<p>/docs and are copied into
// pages/<p>/ by scripts/pages_sync.mjs (run before dev/build). A project's sidebar comes from its
// docs/pages.json ("sidebar"), else from its pages' first headings.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type DefaultTheme } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { APPS } from "./theme/apps";

const root = join(__dirname, "../..");
const base = "/hejitech-apps/";

interface ProjectPages {
  name: string;
  sidebar?: DefaultTheme.SidebarItem[];
}

/** Search-only sections for the home page: one per app card (AppCards.vue, which the search index
 * can't render), under the card's anchor, plus the words people search with that the card doesn't
 * say ("baby log" finds Wee Hours). */
const appSearchSections = APPS.map((a) => `## ${a.name} {#${a.id}}\n\n${a.tagline} ${a.desc} ${a.platforms.join(", ")}. Also: ${a.synonyms.join(", ")}.`).join("\n\n");

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
    description: "Small, focused apps by HEJI Technology: Waypack, Wee Hours, Voxbrief, Meowtrix, Contempo, ToddlerCam, TinyTouch and what comes next.",
    base,
    cleanUrls: true,
    vite: { define: { __PAGES_BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? "local").slice(0, 7)) } },
    head: [
      // ?v=2: until 2026-10-16 this address was Waypack's docs, and browsers keep a site's old icon.
      ["link", { rel: "icon", href: `${base}heji.svg?v=3`, type: "image/svg+xml" }],
      ["link", { rel: "icon", href: `${base}heji-192.png?v=3`, type: "image/png", sizes: "192x192" }],
      ["link", { rel: "apple-touch-icon", href: `${base}apple-touch-icon.png?v=3` }],
      ["meta", { name: "theme-color", content: "#2f5bea" }],
    ],
    themeConfig: {
      logo: "/heji.svg",
      siteTitle: "HEJI Apps",
      nav: [
        // The home page's app cards link each project; the nav stays short.
        { text: "Apps", link: "/#apps" },
        { text: "Monorepo", link: "/monorepo" },
        // Styled as a button in custom.css (.VPNavBarMenuLink[href$="/status"]).
        { text: "● Status", link: "/status", activeMatch: "^/status" },
      ],
      sidebar: Object.fromEntries(projects.map((p) => [`/${p}/`, sidebarFor(p)])),
      socialLinks: [{ icon: "github", link: "https://github.com/tianhaoz95/hejitech-apps" }],
      search: {
        provider: "local",
        options: {
          detailedView: true,
          _render(src, env, md) {
            const html = md.render(src, env);
            if (env.frontmatter?.search === false) return "";
            return env.relativePath === "index.md" ? html + md.render(appSearchSections, { ...env }) : html;
          },
        },
      },
      outline: { level: [2, 3] },
      footer: {
        message: "Source available under the PolyForm Perimeter License 1.0.1.",
        copyright: "Copyright © 2026 Tianhao Zhou · HEJI Technology LLC",
      },
    },
  }),
);
