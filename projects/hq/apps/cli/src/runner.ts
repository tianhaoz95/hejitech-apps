// The runner: claims work from HQ and does it on this machine. It holds the credentials (the runner
// token, git, signing on a Mac), so CEO and scout sessions never do (PRD §10). Agents it starts get
// only an agent token for the MCP server.
//
// Run kinds: health (every .hq/bin/health), verb (one .hq/bin verb), scout, ceo, build (in its own
// git worktree on branch hq/<card>), review (a second agent checks the build), reply (answer the
// owner's comment).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { contextMarkdown, type Context, type RepoPolicy } from "@hq/core";
import { runAgent, type Role } from "./adapters.ts";
import type { HqClient } from "./client.ts";
import { buildPrompt, ceoPrompt, replyPrompt, reviewPrompt, scoutPrompt, type CardDetail } from "./prompts.ts";
import { runVerb } from "./repo.ts";

export interface RunnerOptions {
  root: string;
  name: string;
  capabilities: string[];
  /** Where build worktrees go (outside the repo). */
  workdir: string;
  /** Branch builds start from. */
  base: string;
  agentToken: string;
  log: (msg: string) => void;
}

interface Claimed {
  run: { id: string; kind: string; project: string | null; scout: string | null; card_id: string | null; verb: string | null; args: Record<string, unknown>; agent: string | null; session: string | null } | null;
  context?: Context;
  card?: CardDetail | null;
  policy?: RepoPolicy;
  paused?: boolean;
  over_budget?: boolean;
}

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function findSkill(root: string, name: string): string | null {
  for (const d of [".claude/skills", ".agents/skills", "skills"]) {
    const p = join(root, d, name, "SKILL.md");
    if (existsSync(p)) return join(d, name, "SKILL.md");
  }
  return null;
}

export async function runOnce(client: HqClient, o: RunnerOptions): Promise<"worked" | "idle"> {
  const c = await client.call<Claimed>("POST", "/api/runs/claim", { runner: o.name, capabilities: o.capabilities });
  if (!c.run) {
    if (c.paused) o.log("HQ is paused");
    else if (c.over_budget) o.log("over this week's budget: scouts wait");
    return "idle";
  }
  const run = c.run;
  o.log(`run ${run.id}: ${run.kind}${run.scout ? ` ${run.scout}` : ""}${run.verb ? ` ${run.verb}` : ""}${run.project ? ` (${run.project})` : ""}${run.card_id ? ` card ${run.card_id}` : ""}`);
  const finish = (body: Record<string, unknown>) => client.call("POST", `/api/runs/${run.id}/finish`, body);
  try {
    const policy = c.policy!;
    switch (run.kind) {
      case "health":
        return await health(client, o, policy, finish);
      case "verb":
        return await verb(client, o, policy, run, finish);
      case "build":
        return await build(client, o, c, finish);
      default:
        return await agentRun(client, o, c, finish);
    }
  } catch (e) {
    o.log(`run ${run.id} failed: ${(e as Error).message}`);
    await finish({ status: "failed", summary: (e as Error).message.slice(0, 500) }).catch(() => {});
    return "worked";
  }
}

async function health(client: HqClient, o: RunnerOptions, policy: RepoPolicy, finish: (b: Record<string, unknown>) => Promise<unknown>) {
  const targets = [["repo-wide", policy.verbs] as const, ...Object.values(policy.projects).map((p) => [p.name, p.verbs] as const)].filter(([, v]) => v.health);
  const lines: string[] = [];
  for (const [project] of targets) {
    const r = runVerb(o.root, policy, project, "health", { timeoutMs: 5 * 60_000 });
    const data = (r.json && typeof r.json === "object" ? r.json : { ok: false, error: `health exited ${r.code}`, stderr: r.stderr.slice(-500) }) as Record<string, unknown>;
    if (r.code !== 0) data.ok = false;
    await client.call("PUT", "/api/health", { project, data });
    lines.push(`${project}: ${data.ok === false ? "needs attention" : "ok"}`);
  }
  await finish({ status: "done", summary: lines.join("; ") || "no health verbs", output: lines.join("\n") });
  return "worked" as const;
}

async function verb(client: HqClient, o: RunnerOptions, policy: RepoPolicy, run: NonNullable<Claimed["run"]>, finish: (b: Record<string, unknown>) => Promise<unknown>) {
  const dry = run.args.dry_run === true;
  // The server checked the tier; check again here, against this checkout's policy.
  const v = run.project === "repo-wide" ? policy.verbs[run.verb!] : policy.projects[run.project!]?.verbs[run.verb!];
  if (!v) throw new Error(`${run.project} has no verb ${run.verb} in this checkout`);
  const r = runVerb(o.root, policy, run.project!, run.verb!, { dryRun: dry });
  const output = `$ .hq/bin/${run.verb}${dry ? " --dry-run" : ""}  (exit ${r.code}, ${Math.round(r.ms / 1000)} s)\n${r.stdout}${r.stderr ? `\n[stderr]\n${r.stderr}` : ""}`;
  if (run.card_id) {
    await client.call("POST", `/api/cards/${run.card_id}/evidence`, { phase: "verb", evidence: { type: "log", ref: `.hq/bin/${run.verb}${dry ? " --dry-run" : ""}`, text: output.slice(-7000) } });
  }
  await finish({ status: r.code === 0 ? "done" : "failed", summary: `${run.verb}${dry ? " (dry run)" : ""} exited ${r.code}`, output });
  return "worked" as const;
}

function ensureWorktree(o: RunnerOptions, cardId: string): { path: string; branch: string } {
  const branch = `hq/${cardId}`;
  const path = join(o.workdir, `${basename(o.root)}-${cardId}`);
  mkdirSync(o.workdir, { recursive: true });
  if (existsSync(path) && statSync(path).isDirectory()) return { path, branch };
  let exists = true;
  try {
    git(o.root, "rev-parse", "--verify", branch);
  } catch {
    exists = false;
  }
  if (exists) git(o.root, "worktree", "add", path, branch);
  else git(o.root, "worktree", "add", "-b", branch, path, o.base);
  return { path, branch };
}

async function build(client: HqClient, o: RunnerOptions, c: Claimed, finish: (b: Record<string, unknown>) => Promise<unknown>) {
  const run = c.run!;
  const card = c.card!;
  const policy = c.policy!;
  const wt = ensureWorktree(o, card.card.id);
  o.log(`building in ${wt.path} on ${wt.branch}`);
  const before = git(wt.path, "rev-parse", "HEAD");
  const res = await runAgent({
    agent: run.agent ?? policy.agents.executor, role: "build", cwd: wt.path,
    prompt: buildPrompt({ card, context: contextMarkdown(c.context!), branch: wt.branch, worktree: wt.path, base: o.base }),
    mcp: { url: client.url, token: o.agentToken }, timeoutMs: 90 * 60_000,
  });
  const commits = git(wt.path, "log", "--oneline", `${before}..HEAD`);
  const stat = commits ? git(wt.path, "diff", "--stat", `${before}..HEAD`) : "";
  if (commits) {
    await client.call("POST", `/api/cards/${card.card.id}/evidence`, { phase: "build", evidence: { type: "commit", ref: wt.branch, text: `${commits}\n\n${stat}`.slice(0, 7000) } });
  }
  // Independent check: the project's own verify verb, run by the runner, not the agent.
  const verbs = card.card.project === "repo-wide" ? policy.verbs : policy.projects[card.card.project]?.verbs ?? {};
  let verified: boolean | null = null;
  if (commits && verbs.verify) {
    const r = runVerb(wt.path, policy, card.card.project, "verify", { timeoutMs: 30 * 60_000 });
    verified = r.code === 0;
    await client.call("POST", `/api/cards/${card.card.id}/evidence`, { phase: "build", evidence: { type: "test", ref: ".hq/bin/verify", text: `exit ${r.code} in ${Math.round(r.ms / 1000)} s\n${(r.stdout + r.stderr).slice(-5000)}` } });
  }
  let pr_url: string | undefined;
  if (commits && policy.push && verified !== false) {
    git(wt.path, "push", "-u", "origin", wt.branch);
    pr_url = execFileSync("gh", ["pr", "create", "--head", wt.branch, "--base", o.base, "--title", card.card.title, "--body", `HQ card ${card.card.id}\n\n${card.card.why}\n\n**Verify:** ${card.card.verify}`], { cwd: wt.path, encoding: "utf8" }).trim();
  }
  const ok = res.ok && !!commits && verified !== false;
  await finish({
    status: ok ? "done" : "failed",
    summary: !commits ? `no commits: ${res.summary}` : verified === false ? `verify failed: ${res.summary}` : res.summary,
    output: res.output, cost_usd: res.costUsd, session: res.session ?? undefined, branch: wt.branch, pr_url,
  });
  return "worked" as const;
}

async function agentRun(client: HqClient, o: RunnerOptions, c: Claimed, finish: (b: Record<string, unknown>) => Promise<unknown>) {
  const run = c.run!;
  const policy = c.policy!;
  const ctx = contextMarkdown(c.context!);
  let role: Role;
  let prompt: string;
  let cwd = o.root;
  let session: string | null = null;
  switch (run.kind) {
    case "scout": {
      role = "scout";
      const project = run.project ?? "repo-wide";
      prompt = scoutPrompt({
        scout: run.scout!, project, projectDir: project === "repo-wide" ? null : policy.projects[project]?.dir ?? null,
        cardLimit: Number(run.args.card_limit ?? 3), skillPath: findSkill(o.root, run.scout!), context: ctx,
      });
      break;
    }
    case "ceo":
      role = "ceo";
      prompt = ceoPrompt({ context: ctx });
      break;
    case "review": {
      role = "review";
      const card = c.card!;
      if (!card.card.branch) throw new Error("card has no branch to review");
      const wt = join(o.workdir, `${basename(o.root)}-${card.card.id}`);
      cwd = existsSync(wt) ? wt : o.root;
      prompt = reviewPrompt({ card, context: ctx, worktree: cwd, base: o.base, branch: card.card.branch });
      break;
    }
    case "reply":
      role = "reply";
      prompt = replyPrompt({ card: c.card!, context: ctx });
      session = run.session;
      break;
    default:
      throw new Error(`unknown run kind ${run.kind}`);
  }
  const agent = run.agent ?? (role === "ceo" ? policy.agents.ceo : role === "review" ? policy.agents.reviewer : policy.agents.scout);
  const mcp = { url: client.url, token: o.agentToken };
  let res = await runAgent({ agent, role, prompt, cwd, mcp, session });
  if (!res.ok && session) {
    // The session may live on another machine; answer from a fresh one.
    res = await runAgent({ agent, role, prompt, cwd, mcp });
  }
  await finish({ status: res.ok ? "done" : "failed", summary: res.summary, output: res.output, cost_usd: res.costUsd, session: res.session ?? undefined });
  return "worked" as const;
}

export async function loop(client: HqClient, o: RunnerOptions, intervalSec: number, once: boolean) {
  for (;;) {
    let r: "worked" | "idle" = "idle";
    try {
      r = await runOnce(client, o);
    } catch (e) {
      o.log(`claim failed: ${(e as Error).message}`);
    }
    if (once && r === "idle") return;
    if (r === "idle") await new Promise((res) => setTimeout(res, intervalSec * 1000));
  }
}
