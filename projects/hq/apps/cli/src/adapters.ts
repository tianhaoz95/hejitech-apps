// Agent adapters: how to start an agent headless, hand it the prompt and the HQ MCP server, and
// collect its output. Adding an agent means adding an adapter here (PRD §7); the repo doesn't change.
//
//   claude   Claude Code (`claude -p … --output-format json`): cost and session id come back.
//   command  Any other agent through a command template in HQ_AGENT_<NAME>_CMD, e.g.
//            HQ_AGENT_CODEX_CMD='codex exec --full-auto "$(cat {prompt_file})"'. {prompt_file},
//            {mcp_url}, {mcp_token} and {cwd} are substituted. Cost isn't known (0).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Role = "scout" | "ceo" | "build" | "review" | "reply";

export interface AgentRun {
  agent: string;
  role: Role;
  prompt: string;
  cwd: string;
  mcp: { url: string; token: string };
  session?: string | null;
  timeoutMs?: number;
  maxBudgetUsd?: number;
}

export interface AgentResult {
  ok: boolean;
  output: string;
  costUsd: number;
  session: string | null;
  summary: string;
}

/** Tools a role may never use, whatever the agent's own settings say. */
const DENY_ALWAYS = [
  "Bash(git push:*)", "Bash(git push)", "Bash(gh pr merge:*)", "Bash(gh release:*)", "Bash(gh workflow run:*)",
  "Bash(wrangler deploy:*)", "Bash(npx wrangler deploy:*)", "Bash(*.hq/bin/release*)", "Bash(*.hq/bin/rollback*)", "Bash(git reset --hard:*)",
  "Bash(rm -rf /:*)", "Bash(supabase db push:*)", "Bash(*wrangler secret:*)", "Bash(gh secret:*)",
];
/** Repo-specific additions, e.g. HQ_DENY_TOOLS='Bash(*my_release.sh*),Bash(fly deploy:*)'. */
const extraDeny = () => (process.env.HQ_DENY_TOOLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const READ_ONLY_DENY = ["Edit", "Write", "NotebookEdit", "Bash(git commit:*)", "Bash(git checkout:*)", "Bash(git add:*)"];

const ALLOW: Record<Role, string[]> = {
  scout: ["mcp__hq__*", "Read", "Grep", "Glob", "Bash(gh run list:*)", "Bash(gh run view:*)", "Bash(gh api:*)", "Bash(git log:*)", "Bash(git show:*)", "Bash(git diff:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(node --version)", "Bash(npm outdated:*)", "Bash(npm view:*)", "Bash(npm ls:*)", "WebSearch", "WebFetch", "Skill"],
  ceo: ["mcp__hq__*", "Read", "Grep", "Glob", "Bash(git log:*)", "Bash(gh run list:*)", "Bash(gh run view:*)"],
  review: ["mcp__hq__*", "Read", "Grep", "Glob", "Bash(git diff:*)", "Bash(git log:*)", "Bash(git show:*)", "Bash(npm test:*)", "Bash(npm run:*)"],
  reply: ["mcp__hq__*", "Read", "Grep", "Glob", "Bash(git log:*)", "Bash(gh run view:*)"],
  build: ["mcp__hq__*", "Read", "Grep", "Glob", "Edit", "Write", "Bash"],
};

export function summaryOf(text: string): string {
  const m = text.match(/SUMMARY:\s*(.+)/);
  const memo = text.match(/MEMO:\s*([\s\S]+?)(?:\n\s*SUMMARY:|$)/);
  if (memo) return `${memo[1].trim()}${m ? `\n\n${m[1].trim()}` : ""}`.slice(0, 2000);
  return (m?.[1] ?? text.trim().split("\n").filter(Boolean).pop() ?? "").slice(0, 2000);
}

function spawnCapture(cmd: string, args: string[], cwd: string, timeoutMs: number, env: NodeJS.ProcessEnv, input?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: String(e) });
    });
    if (input && child.stdin) child.stdin.end(input);
  });
}

async function claude(r: AgentRun): Promise<AgentResult> {
  const dir = mkdtempSync(join(tmpdir(), "hq-agent-"));
  try {
    const mcpFile = join(dir, "mcp.json");
    writeFileSync(mcpFile, JSON.stringify({ mcpServers: { hq: { type: "http", url: `${r.mcp.url}/mcp`, headers: { Authorization: `Bearer ${r.mcp.token}` } } } }), { mode: 0o600 });
    const deny = [...DENY_ALWAYS, ...extraDeny(), ...(r.role === "build" ? [] : READ_ONLY_DENY)];
    const args = [
      "-p", "--output-format", "json",
      "--mcp-config", mcpFile, "--strict-mcp-config",
      "--permission-mode", r.role === "build" ? "acceptEdits" : "default",
      "--allowedTools", ...ALLOW[r.role],
      "--disallowedTools", ...deny,
    ];
    if (r.maxBudgetUsd) args.push("--max-budget-usd", String(r.maxBudgetUsd));
    if (r.session) args.push("--resume", r.session);
    const res = await spawnCapture("claude", args, r.cwd, r.timeoutMs ?? 45 * 60_000, { ...process.env, HQ_TOKEN: "", CLAUDECODE: "" }, r.prompt);
    let parsed: { result?: string; total_cost_usd?: number; session_id?: string; is_error?: boolean } = {};
    try {
      parsed = JSON.parse(res.stdout.trim().split("\n").pop() ?? "{}");
    } catch {
      /* not JSON: fall through */
    }
    const output = parsed.result ?? (res.stdout || res.stderr);
    return {
      ok: res.code === 0 && !parsed.is_error,
      output: output + (res.code !== 0 && res.stderr ? `\n\n[stderr]\n${res.stderr.slice(-4000)}` : ""),
      costUsd: Number(parsed.total_cost_usd ?? 0) || 0,
      session: parsed.session_id ?? null,
      summary: summaryOf(output),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function command(r: AgentRun): Promise<AgentResult> {
  const tpl = process.env[`HQ_AGENT_${r.agent.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_CMD`];
  if (!tpl) throw new Error(`no adapter for agent "${r.agent}": set HQ_AGENT_${r.agent.toUpperCase()}_CMD (see adapters.ts)`);
  const dir = mkdtempSync(join(tmpdir(), "hq-agent-"));
  try {
    const promptFile = join(dir, "prompt.md");
    writeFileSync(promptFile, r.prompt);
    const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
    const cmd = tpl.replaceAll("{prompt_file}", q(promptFile)).replaceAll("{mcp_url}", q(`${r.mcp.url}/mcp`)).replaceAll("{mcp_token}", q(r.mcp.token)).replaceAll("{cwd}", q(r.cwd));
    const res = await spawnCapture("bash", ["-c", cmd], r.cwd, r.timeoutMs ?? 45 * 60_000, { ...process.env, HQ_TOKEN: "", HQ_MCP_URL: `${r.mcp.url}/mcp`, HQ_MCP_TOKEN: r.mcp.token, HQ_ROLE: r.role });
    const output = res.stdout || res.stderr;
    return { ok: res.code === 0, output, costUsd: 0, session: null, summary: summaryOf(output) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function runAgent(r: AgentRun): Promise<AgentResult> {
  return r.agent === "claude" ? claude(r) : command(r);
}
