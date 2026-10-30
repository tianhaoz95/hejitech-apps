// The executor's local configuration and secret files, all under one folder (default
// ~/.tradeboard, or $TRADEBOARD_HOME), never synced to a hosted service and never committed:
//
//   config.json             board URL, executor id and credential, the dedicated account number,
//                           the local model endpoint, the local live opt-in        (mode 0600)
//   robinhood-oauth.json    Robinhood MCP OAuth client + tokens (loopback flow)     (mode 0600)
//   policy.json             the last policy version loaded from the board (cache)
//   journal.jsonl           orders about to be placed, for recovery after a crash
//   KILL                    if this file exists, the executor stops claiming (§11.8)
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  board_url: string;
  executor_id: string;
  executor_token: string;
  robinhood: {
    mcp_url: string;
    /** The dedicated agentic account's number. Stays on this machine; only "••••1234" reaches the board. */
    account_number: string;
    redirect_port: number;
  };
  model: {
    /** false skips the sanity check: dry-run only, unless the policy sets allow_live_without_model_check. */
    enabled: boolean;
    /** Any OpenAI-compatible endpoint: Ollama (http://127.0.0.1:11434/v1), vLLM, llama.cpp server. */
    base_url: string;
    model: string;
    api_key?: string;
    timeout_ms: number;
    /** Reply budget. Thinking models spend part of it reasoning before the JSON: too small cuts the JSON off. */
    max_tokens: number;
    /** Optional, passed through (e.g. "none" turns thinking off on Ollama, "low"…"high"). */
    reasoning_effort?: string;
  };
  poll_interval_sec: number;
  heartbeat_sec: number;
  max_plans_per_loop: number;
  /** The owner's local opt-in to live mode (§12.2). The board's switch alone is not enough. */
  allow_live: boolean;
}

export const DEFAULTS: Omit<Config, "board_url" | "executor_id" | "executor_token"> = {
  robinhood: { mcp_url: "https://agent.robinhood.com/mcp/trading", account_number: "", redirect_port: 8765 },
  model: { enabled: true, base_url: "http://127.0.0.1:11434/v1", model: "gemma4:26b", timeout_ms: 180_000, max_tokens: 2048 },
  poll_interval_sec: 15,
  heartbeat_sec: 30,
  max_plans_per_loop: 1,
  allow_live: false,
};

export const home = () => process.env.TRADEBOARD_HOME || join(homedir(), ".tradeboard");
export const paths = () => {
  const h = home();
  return { home: h, config: join(h, "config.json"), oauth: join(h, "robinhood-oauth.json"), policy: join(h, "policy.json"), journal: join(h, "journal.jsonl"), kill: join(h, "KILL") };
};

export function ensureHome() {
  const h = home();
  if (!existsSync(h)) mkdirSync(h, { recursive: true, mode: 0o700 });
  chmodSync(h, 0o700);
}

/** Writes a file only the owner can read (tokens, config with the credential). */
export function writeSecret(path: string, content: string) {
  ensureHome();
  writeFileSync(path, content, { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function checkConfig(c: Partial<Config>): string[] {
  const out: string[] = [];
  if (!c.board_url || !/^https?:\/\//.test(c.board_url)) out.push("board_url must be the board's URL (https://…)");
  if (c.board_url?.startsWith("http://") && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(c.board_url)) out.push("board_url must be https (http only for a local board)");
  if (!c.executor_id || !/^[a-z0-9][a-z0-9._-]{0,47}$/.test(c.executor_id)) out.push("executor_id: lowercase letters, digits, . _ -");
  if (!c.executor_token?.startsWith("tbx_")) out.push("executor_token must be a tbx_… credential from the portal's Executor page");
  if (!c.robinhood?.mcp_url) out.push("robinhood.mcp_url is required");
  if (!c.robinhood?.account_number) out.push("robinhood.account_number (the dedicated agentic account) is required");
  if (!Number.isInteger(c.robinhood?.redirect_port)) out.push("robinhood.redirect_port must be a port number");
  if (!c.model?.base_url || !c.model?.model) out.push("model.base_url and model.model are required (set model.enabled false to skip the check in dry-run)");
  if (!(Number(c.poll_interval_sec) >= 10 && Number(c.poll_interval_sec) <= 30)) out.push("poll_interval_sec must be 10–30 (§12.3)");
  if (!(Number(c.max_plans_per_loop) >= 1)) out.push("max_plans_per_loop must be at least 1");
  return out;
}

export function loadConfig(): Config {
  const p = paths();
  const raw = readJson<Partial<Config>>(p.config);
  if (!raw) throw new Error(`no ${p.config}: run \`tradeboard-executor setup\` first`);
  const mode = statSync(p.config).mode & 0o777;
  if (mode & 0o077) throw new Error(`${p.config} is readable by others (mode ${mode.toString(8)}): chmod 600 it`);
  const c: Config = { ...DEFAULTS, ...raw, robinhood: { ...DEFAULTS.robinhood, ...raw.robinhood }, model: { ...DEFAULTS.model, ...raw.model } } as Config;
  const issues = checkConfig(c);
  if (issues.length) throw new Error(`config problems:\n  ${issues.join("\n  ")}`);
  return c;
}

export function killFilePresent(): boolean {
  return existsSync(paths().kill);
}

/** Never log a secret: account numbers and tokens are masked wherever the executor prints. */
export function redact(s: string, c?: Pick<Config, "executor_token" | "robinhood">): string {
  let out = s.replace(/tb[ax]_[A-Za-z0-9_-]{8,}/g, "tb?_[redacted]").replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[redacted]");
  if (c?.robinhood.account_number && c.robinhood.account_number.length >= 4) out = out.split(c.robinhood.account_number).join(`••••${c.robinhood.account_number.slice(-4)}`);
  return out;
}
