// Where `hq` finds the HQ address and its tokens, in this order:
//
//   1. the environment: HQ_URL + HQ_TOKEN (and HQ_AGENT_TOKEN), for headless runners and CI;
//   2. the login `hq login` saved for this repo (one file, readable only by its owner).
//
// A workspace is one repository, so saved logins are kept per repo name (`repo:` in .hq/HQ.md):
// every checkout and worktree of the repo on this machine shares one.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The hosted HQ. `hq login` offers it as the default address. */
export const DEFAULT_URL = "https://hq.hejitech.workers.dev";

export interface Login {
  url: string;
  token: string;
  agent_token?: string;
  workspace?: string;
  saved_at?: string;
}

export interface Credentials extends Login {
  source: "environment" | "saved";
}

type Env = Record<string, string | undefined>;

export const configDir = (env: Env = process.env) => env.HQ_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "hq");
export const credentialsFile = (env: Env = process.env) => join(configDir(env), "credentials.json");

function readAll(env: Env): Record<string, Login> {
  try {
    const data = JSON.parse(readFileSync(credentialsFile(env), "utf8")) as { logins?: Record<string, Login> };
    return data.logins && typeof data.logins === "object" ? data.logins : {};
  } catch {
    return {};
  }
}

function writeAll(logins: Record<string, Login>, env: Env) {
  const dir = configDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = credentialsFile(env);
  // Written beside the file and renamed, so it is never half-written or readable by others.
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, logins }, null, 2) + "\n", { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

export const savedLogin = (repo: string, env: Env = process.env): Login | null => {
  const l = readAll(env)[repo];
  return l?.url && l?.token ? l : null;
};

export function saveLogin(repo: string, login: Login, env: Env = process.env) {
  writeAll({ ...readAll(env), [repo]: { ...login, saved_at: new Date().toISOString() } }, env);
}

export function removeLogin(repo: string, env: Env = process.env): boolean {
  const all = readAll(env);
  if (!all[repo]) return false;
  delete all[repo];
  if (existsSync(credentialsFile(env))) writeAll(all, env);
  return true;
}

/** The environment first, then the saved login; null when neither has an address and a token. */
export function resolveCredentials(repo: string | null, env: Env = process.env): Credentials | null {
  if (env.HQ_URL && env.HQ_TOKEN) return { url: env.HQ_URL, token: env.HQ_TOKEN, agent_token: env.HQ_AGENT_TOKEN || undefined, source: "environment" };
  const saved = repo ? savedLogin(repo, env) : null;
  if (!saved) return null;
  return { ...saved, agent_token: env.HQ_AGENT_TOKEN || saved.agent_token, source: "saved" };
}

/** What a person types as the address: scheme optional, and the MCP address works too. */
export function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `${/^(localhost|127\.|\[::1\])/i.test(u) ? "http" : "https"}://${u}`;
  return u.replace(/\/+$/, "").replace(/\/mcp$/i, "").replace(/\/+$/, "");
}
