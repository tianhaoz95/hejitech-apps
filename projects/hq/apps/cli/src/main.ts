// `hq`: the repo side of HQ.
//
//   hq lint [--no-run]            check every .hq/ (schema, verbs exist/executable, dry runs)
//   hq policy                     print the merged policy as JSON
//   hq login [--url <address>] [--browser | --token] [--no-open]   sign in and save it for this repo
//   hq logout                     forget this repo's saved login
//   hq sync                       upload the policy to HQ
//   hq context [project]          print what agents get from hq.get_context
//   hq verb <project> <verb> [--dry-run]   run a verb locally, as the runner would
//   hq runner [--once] [--caps mac-runner,cloud] [--interval 60]   claim and do work
//   hq init [--repo owner/name]   add a root .hq/ to a repo that has none
//   hq --version
//
// The repo is the git repository around the current directory (or --root <dir>).
// Commands that talk to HQ take the address and tokens from the environment (HQ_URL, HQ_TOKEN,
// HQ_AGENT_TOKEN: headless runners and CI), else from `hq login`'s saved login, else they start
// `hq login` when there is a terminal.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { contextMarkdown } from "@hq/core";
import { HqClient } from "./client.ts";
import { credentialsFile, removeLogin, resolveCredentials, type Credentials } from "./credentials.ts";
import { interactive, login } from "./login.ts";
import { headCommit, lint, loadPolicy, repoName, repoRoot, runVerb } from "./repo.ts";
import { loop } from "./runner.ts";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  argv.splice(i, 1);
  return true;
};
const opt = (name: string) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};

const die = (msg: string, code = 1): never => {
  console.error(msg);
  process.exit(code);
};

/** The environment, then the saved login, then (at a terminal) `hq login`. */
async function connect(root: string): Promise<{ client: HqClient; creds: Credentials }> {
  let creds = resolveCredentials(repoName(root));
  if (!creds) {
    if (!interactive()) die("not signed in: set HQ_URL and HQ_TOKEN (a runner token from the portal's Settings), or run `hq login` at a terminal");
    console.log("Not signed in to HQ for this repo yet.\n");
    creds = await login(root);
    console.log("");
  }
  return { client: new HqClient(creds.url, creds.token), creds };
}

async function main() {
  const root = opt("--root") ?? repoRoot();
  const cmd = argv.shift();
  switch (cmd) {
    case "lint": {
      const noRun = flag("--no-run");
      const r = lint(root, { runVerbs: !noRun });
      for (const w of r.warnings) console.log(`warning: ${w}`);
      for (const e of r.errors) console.error(`error: ${e}`);
      if (r.errors.length) die(`hq lint: ${r.errors.length} problem${r.errors.length === 1 ? "" : "s"}`);
      const p = r.policy!;
      console.log(`hq lint: ok — ${p.repo}, root + ${Object.keys(p.projects).length} project${Object.keys(p.projects).length === 1 ? "" : "s"} (${Object.keys(p.projects).join(", ")})`);
      return;
    }
    case "policy": {
      const { policy, errors } = loadPolicy(root);
      if (!policy) die(errors.join("\n"));
      console.log(JSON.stringify(policy, null, 2));
      return;
    }
    case "login": {
      const method = flag("--browser") ? "browser" : flag("--token") ? "token" : undefined;
      await login(root, { url: opt("--url"), method, open: !flag("--no-open"), timeoutSec: Number(opt("--timeout") ?? 600) });
      if (process.env.HQ_URL && process.env.HQ_TOKEN) console.log("Note: HQ_URL and HQ_TOKEN are set in this shell and take priority over the saved login.");
      return;
    }
    case "logout": {
      const repo = repoName(root) ?? die("no .hq/HQ.md with a `repo:` here");
      console.log(removeLogin(repo as string) ? `forgot the login for ${repo} (${credentialsFile()}); revoke its tokens in the portal's Settings if they're no longer needed` : `no saved login for ${repo}`);
      return;
    }
    case "sync": {
      const { policy, errors } = loadPolicy(root);
      if (!policy) die(`not synced; fix these first (hq lint):\n${errors.join("\n")}`);
      const { client } = await connect(root);
      await client.call("PUT", "/api/config", { policy, commit: headCommit(root) });
      console.log(`synced ${policy!.repo} (${Object.keys(policy!.projects).length} projects) to ${client.url}`);
      return;
    }
    case "context": {
      const project = argv.shift() ?? null;
      const { client } = await connect(root);
      const ctx = await client.call("GET", `/api/context${project ? `?project=${encodeURIComponent(project)}` : ""}`);
      console.log(flag("--json") ? JSON.stringify(ctx, null, 2) : contextMarkdown(ctx));
      return;
    }
    case "verb": {
      const [project, verb] = argv;
      if (!project || !verb) die("usage: hq verb <project|repo-wide> <verb> [--dry-run]");
      const dry = !!flag("--dry-run");
      const { policy, errors } = loadPolicy(root);
      if (!policy) die(errors.join("\n"));
      const r = runVerb(root, policy!, project, verb, { dryRun: dry });
      process.stdout.write(r.stdout);
      process.stderr.write(r.stderr);
      process.exit(r.code);
    }
    case "runner": {
      const once = !!flag("--once");
      const caps = (opt("--caps") ?? process.env.HQ_RUNNER_CAPS ?? (process.platform === "darwin" ? "mac-runner,cloud" : "cloud")).split(",").map((s) => s.trim()).filter(Boolean);
      const interval = Number(opt("--interval") ?? 60);
      // Sync first so the server enforces what this checkout says.
      const { policy, errors } = loadPolicy(root);
      if (!policy) die(`fix .hq/ first:\n${errors.join("\n")}`);
      const { client, creds } = await connect(root);
      const agentToken = creds.agent_token ?? die("no agent token: set HQ_AGENT_TOKEN (portal → Settings), or run `hq login` in the browser, which saves one. The runner gives it to the agents it starts");
      await client.call("PUT", "/api/config", { policy, commit: headCommit(root) });
      const name = opt("--name") ?? process.env.HQ_RUNNER_NAME ?? hostname().split(".")[0];
      const log = (m: string) => console.log(`${new Date().toISOString().slice(0, 19)} ${m}`);
      log(`runner ${name} for ${policy!.repo} at ${client.url} (${caps.join(", ")})${once ? ", once" : ""}`);
      await loop(client, { root, name, capabilities: caps, workdir: process.env.HQ_WORKDIR ?? join(dirname(root), ".hq-worktrees"), base: process.env.HQ_BASE ?? "main", agentToken: agentToken as string, log }, interval, once);
      return;
    }
    case "init": {
      const repo = opt("--repo") ?? die("usage: hq init --repo owner/name");
      const dir = join(root, ".hq");
      if (existsSync(join(dir, "HQ.md"))) die(".hq/HQ.md already exists");
      mkdirSync(join(dir, "bin"), { recursive: true });
      writeFileSync(join(dir, "HQ.md"), `---\nhq: 1\nrepo: ${repo}\ntier_ceiling: L1\ninbox_cap: 5\nweekly_budget_usd: 20\npush: false\nscouts: []\n---\n\n# ${repo}: HQ guidance\n\nWhat matters most in this repo, what to leave alone, and how to judge proposals.\nHow to build and test lives in CLAUDE.md/AGENTS.md; don't repeat it here.\n`);
      writeFileSync(join(dir, "bin", "health"), `#!/usr/bin/env bash\n# Prints this repo's health as JSON. Read-only.\nset -euo pipefail\nprintf '{"ok":true}\\n'\n`);
      chmodSync(join(dir, "bin", "health"), 0o755);
      console.log("created .hq/HQ.md and .hq/bin/health; add a line to AGENTS.md pointing agents at HQ, then `hq lint`");
      return;
    }
    case "--version":
    case "version":
      // package.json sits one folder above both the source and the published bundle.
      console.log((JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version);
      return;
    default:
      console.log(`hq: login | logout | lint | policy | sync | context [project] | verb <project> <verb> [--dry-run] | runner [--once] | init --repo owner/name`);
      if (cmd && cmd !== "help" && cmd !== "--help") process.exit(2);
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
