// Build-time data for the status page (status.md): every GitHub Actions workflow, every project's
// release line and the production deployments. Workflows and release lines are read from the repo
// (.github/workflows/*.yml, projects/*/release.env), so a new workflow or project shows up without
// editing the page. The page renders badges from this; the live panel adds the latest runs from the
// GitHub API in the browser.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type WorkflowKind = "ci" | "release" | "deploy" | "automation";

/** A workflow run, as the GitHub API returns it (the fields the page shows). */
export interface RunInfo {
  status: string;
  conclusion: string | null;
  event: string;
  html_url: string;
  run_started_at: string;
  updated_at: string;
}

export interface Workflow {
  file: string;
  name: string;
  kind: WorkflowKind;
  triggers: string[];
  /** Its latest run that did something (skipped runs ignored), looked up when the site was built;
   * the browser's live window of the repo's last 100 runs is too short for quiet workflows. */
  lastRun?: RunInfo | null;
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
  { name: "ToddlerCam site (App Store privacy/support URLs)", project: "toddlercam", url: "https://tianhaoz95.github.io/hejitech-apps/toddlercam/site/", via: "GitHub Pages", workflow: "pages.yml" },
  { name: "TinyTouch site (App Store privacy/support URLs)", project: "tinytouch", url: "https://tianhaoz95.github.io/hejitech-apps/tinytouch/site/", via: "GitHub Pages", workflow: "pages.yml" },
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

/** The workflow's newest run that wasn't skipped (else its newest), with the build's GITHUB_TOKEN
 * (pages.yml); null without a token (local builds) or on any API error. */
async function latestRun(file: string): Promise<RunInfo | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/tianhaoz95/hejitech-apps/actions/workflows/${file}/runs?per_page=20`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const runs = ((await r.json()).workflow_runs ?? []) as RunInfo[];
    const run = runs.find((x) => x.conclusion !== "skipped") ?? runs[0];
    if (!run) return null;
    const { status, conclusion, event, html_url, run_started_at, updated_at } = run;
    return { status, conclusion, event, html_url, run_started_at, updated_at };
  } catch {
    return null;
  }
}

// A plain object (not `defineLoader`): VitePress loads this file as CommonJS, and vitepress is ESM.
export default {
  // Paths are relative to the site root (pages/).
  watch: ["../.github/workflows/*.yml", "../projects/*/release.env"],
  async load(): Promise<StatusData> {
    // `npm run pages:dev` / `pages:build` run from the repo root.
    const root = process.cwd();
    const wfDir = join(root, ".github", "workflows");
    const ids = readdirSync(join(root, "projects")).filter((p) => existsSync(join(root, "projects", p, "CLAUDE.md"))).sort();
    const workflows = readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)).map((f) => readWorkflow(wfDir, f));
    await Promise.all(workflows.map(async (w) => { w.lastRun = await latestRun(w.file); }));

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
