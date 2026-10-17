// Build-time data for the status page (status.md): every GitHub Actions workflow, every project's
// release line and the production deployments. Workflows and release lines are read from the repo
// (.github/workflows/*.yml, projects/*/release.env), so a new workflow or project shows up without
// editing the page. The page renders badges from this; the live panel adds the latest runs from the
// GitHub API in the browser.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type WorkflowKind = "ci" | "release" | "deploy" | "automation";

export interface Workflow {
  file: string;
  name: string;
  kind: WorkflowKind;
  triggers: string[];
}

export interface ProjectStatus {
  id: string;
  name: string;
  /** Release tag prefix from release.env (e.g. "waypack-v"), when the project cuts releases. */
  tagPrefix: string | null;
  workflows: Workflow[];
}

/** A production surface: health is the URL answering (shields' website badge), plus how it deploys. */
export interface Deployment {
  name: string;
  project: string;
  url: string;
  via: string;
  /** The workflow that deploys it, when one does (Cloudflare Workers Builds deploys the Workers). */
  workflow?: string;
  /** False when the URL isn't meant to answer a plain GET with 2xx (an API endpoint). */
  health?: boolean;
}

export interface StatusData {
  projects: ProjectStatus[];
  deployments: Deployment[];
}

// Production URLs aren't in any one file the build can read, so they're listed here.
const DEPLOYMENTS: Deployment[] = [
  { name: "Waypack site, API + MCP", project: "waypack", url: "https://waypack.hejitech.workers.dev", via: "Cloudflare Workers Builds" },
  { name: "Wee Hours site + MCP", project: "weehours", url: "https://weehours.hejitech.workers.dev", via: "Cloudflare Workers Builds" },
  { name: "Contempo web app + API", project: "contempo", url: "https://contempo.hejitech.workers.dev", via: "Cloudflare Workers" },
  { name: "FeedbackKit dashboard", project: "feedbackkit", url: "https://feedback-kit.hejitech.workers.dev", via: "Cloudflare Workers Builds" },
  { name: "FeedbackKit Edge Functions", project: "feedbackkit", url: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback", via: "GitHub Actions → Supabase", workflow: "feedbackkit-deploy-functions.yml", health: false },
  { name: "HEJI Apps site (this one)", project: "shared", url: "https://tianhaoz95.github.io/hejitech-apps/", via: "GitHub Pages", workflow: "pages.yml" },
];

const TRIGGERS = ["push", "pull_request", "pull_request_target", "release", "schedule", "workflow_dispatch", "workflow_call", "issues", "issue_comment", "workflow_run"];

function readWorkflow(dir: string, file: string): Workflow {
  const yml = readFileSync(join(dir, file), "utf8");
  const name = yml.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? file;
  // Top-level `on:` keys (block form, which every workflow here uses), or `on: [a, b]` / `on: a`.
  const onBlock = yml.match(/^on:\s*\n((?:[ \t]+.*\n|\s*\n)*)/m)?.[1] ?? "";
  let triggers = TRIGGERS.filter((t) => new RegExp(`^  ${t}:`, "m").test(onBlock));
  if (!triggers.length) {
    const inline = yml.match(/^on:\s*\[?([^\]\n]+)\]?\s*$/m)?.[1];
    triggers = inline ? inline.split(",").map((t) => t.trim()) : [];
  }
  const has = (t: string) => triggers.includes(t);
  const kind: WorkflowKind = has("pull_request")
    ? "ci"
    : has("release")
      ? "release"
      : has("push")
        ? "deploy"
        : "automation";
  return { file, name, kind, triggers };
}

function readReleaseEnv(file: string): { name?: string; tagPrefix?: string } {
  if (!existsSync(file)) return {};
  const env = readFileSync(file, "utf8");
  const get = (k: string) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, "m"))?.[1];
  return { name: get("NAME"), tagPrefix: get("TAG_PREFIX") };
}

const ORDER: WorkflowKind[] = ["ci", "deploy", "release", "automation"];

// A plain object (not `defineLoader`): VitePress loads this file as CommonJS, and vitepress is ESM.
export default {
  // Paths are relative to the site root (pages/).
  watch: ["../.github/workflows/*.yml", "../projects/*/release.env"],
  load(): StatusData {
    // `npm run pages:dev` / `pages:build` run from the repo root.
    const root = process.cwd();
    const wfDir = join(root, ".github", "workflows");
    const ids = readdirSync(join(root, "projects")).filter((p) => existsSync(join(root, "projects", p, "CLAUDE.md"))).sort();
    const workflows = readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)).map((f) => readWorkflow(wfDir, f));

    const sorted = (list: Workflow[]) => list.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
    const projects: ProjectStatus[] = ids.map((id) => {
      const rel = readReleaseEnv(join(root, "projects", id, "release.env"));
      return {
        id,
        name: rel.name ?? id,
        tagPrefix: rel.tagPrefix ?? null,
        workflows: sorted(workflows.filter((w) => w.file.startsWith(`${id}-`))),
      };
    });
    const shared = workflows.filter((w) => !ids.some((id) => w.file.startsWith(`${id}-`)));
    projects.push({ id: "shared", name: "Shared", tagPrefix: null, workflows: sorted(shared) });
    return { projects, deployments: DEPLOYMENTS };
  },
};

export declare const data: StatusData;
