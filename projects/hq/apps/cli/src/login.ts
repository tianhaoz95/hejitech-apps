// `hq login`: connect this repo's checkout to its HQ workspace and save the result, so `hq sync` and
// `hq runner` need no environment variables on a person's machine.
//
// It asks for the HQ address (the hosted HQ is the default), then signs in one of two ways:
//
//   browser  The CLI makes a secret, opens HQ with the secret's hash, and waits. A workspace admin
//            signs in there, checks the short code against the terminal and allows it; HQ then gives
//            the tokens to whoever holds the secret, once. Nothing listens on this machine, so the
//            page can be opened on any device (a server over SSH prints the link).
//   token    Paste a runner token from the portal's Settings (and an agent token for `hq runner`).
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { HqClient } from "./client.ts";
import { DEFAULT_URL, credentialsFile, normalizeUrl, saveLogin, type Credentials } from "./credentials.ts";
import { repoName } from "./repo.ts";

export interface LoginOptions {
  url?: string;
  method?: "browser" | "token";
  /** false: print the link instead of opening a browser. */
  open?: boolean;
  /** How long to wait for the browser approval, in seconds. */
  timeoutSec?: number;
}

export const interactive = () => !!process.stdin.isTTY && !!process.stdout.isTTY;

/** One line from the terminal. Hidden answers (tokens) aren't echoed. */
async function ask(question: string, o: { fallback?: string; hidden?: boolean } = {}): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const query = `${question}${o.fallback ? ` [${o.fallback}]` : ""}: `;
    // readline redraws its own prompt line, so a visible question must be its prompt; a hidden one
    // is written first and everything readline draws after it is dropped.
    if (o.hidden) process.stdout.write(query);
    muted = !!o.hidden;
    const answer = await new Promise<string>((resolve, reject) => {
      rl.on("SIGINT", () => rl.close());
      rl.once("close", () => reject(new Error("cancelled")));
      rl.question(o.hidden ? "" : query, resolve);
    });
    if (o.hidden) process.stdout.write("\n");
    return answer.trim() || o.fallback || "";
  } finally {
    muted = false;
    rl.close();
  }
}

/** The short code shown in the terminal and on the approval page: the same secret on both sides. */
export const displayCode = (challenge: string) => `${challenge.slice(0, 4)}-${challenge.slice(4, 8)}`.toUpperCase();

function openBrowser(url: string) {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd as string, args as string[], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* no browser here: the link is printed */
  }
}

interface Claimed {
  workspace: { id: string; name: string; repo: string };
  runner_token: string;
  agent_token: string;
}

async function browserLogin(url: string, repo: string, o: LoginOptions): Promise<Claimed> {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  const page = new URL("/cli/login/", url);
  page.searchParams.set("challenge", challenge);
  page.searchParams.set("host", hostname().split(".")[0]);
  page.searchParams.set("repo", repo);
  console.log(`\nOpen this page and sign in as an admin of ${repo}'s workspace:\n\n  ${page}\n\nAllow it only if the page shows this code: ${displayCode(challenge)}\n`);
  if (o.open !== false) openBrowser(page.toString());
  process.stdout.write("Waiting for you to allow it in the browser…\n");

  const deadline = Date.now() + (o.timeoutSec ?? 600) * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    let res: Response;
    try {
      res = await fetch(`${url}/api/cli-login/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verifier }) });
    } catch {
      continue; // a dropped connection: keep waiting
    }
    if (res.status === 202) continue;
    const data = (await res.json().catch(() => ({}))) as Claimed & { error?: string };
    if (!res.ok) throw new Error(`sign-in failed: ${data.error ?? `HTTP ${res.status}`}`);
    return data;
  }
  throw new Error("timed out waiting for the browser; run `hq login` again");
}

async function tokenLogin(url: string): Promise<Claimed> {
  if (!interactive()) throw new Error("pasting a token needs a terminal; on a headless machine set HQ_URL and HQ_TOKEN instead");
  console.log(`\nCreate the tokens in ${url} → Settings → Tokens.`);
  const runner = await ask("Runner token (hq_run_…)", { hidden: true });
  if (!runner.startsWith("hq_run_")) throw new Error("that isn't a runner token (it starts with hq_run_)");
  const agent = await ask("Agent token for `hq runner` (hq_agt_…, Enter to skip)", { hidden: true });
  if (agent && !agent.startsWith("hq_agt_")) throw new Error("that isn't an agent token (it starts with hq_agt_)");
  const me = await new HqClient(url, runner).call<{ workspace: Claimed["workspace"] }>("GET", "/api/me");
  if (agent) {
    const other = await new HqClient(url, agent).call<{ workspace: Claimed["workspace"] }>("GET", "/api/me");
    if (other.workspace.id !== me.workspace.id) throw new Error("the two tokens belong to different workspaces");
  }
  return { workspace: me.workspace, runner_token: runner, agent_token: agent };
}

/** Signs in and saves the login for the repo at `root`. */
export async function login(root: string, o: LoginOptions = {}): Promise<Credentials> {
  const repo = repoName(root);
  if (!repo) throw new Error("no .hq/HQ.md with a `repo:` here; run `hq init --repo owner/name` first");
  const ask2 = interactive();

  const suggested = normalizeUrl(process.env.HQ_URL ?? "") || DEFAULT_URL;
  const url = normalizeUrl(o.url ?? (ask2 ? await ask("HQ address", { fallback: suggested }) : suggested));
  const check = await fetch(`${url}/api/health-check`).then((r) => (r.ok ? (r.json() as Promise<{ service?: string }>) : null)).catch(() => null);
  if (check?.service !== "hq") throw new Error(`no HQ answers at ${url}`);

  let method = o.method;
  if (!method && ask2) {
    console.log("\nHow do you want to sign in?\n  1  In the browser (you need to be an admin of the workspace)\n  2  Paste a runner token");
    method = (await ask("Choice", { fallback: "1" })) === "2" ? "token" : "browser";
  }
  const got = method === "token" ? await tokenLogin(url) : await browserLogin(url, repo, o);
  if (got.workspace.repo !== repo) {
    throw new Error(`that workspace is for ${got.workspace.repo}, but this checkout is ${repo}; nothing was saved${method === "token" ? "" : " (revoke the new tokens in Settings)"}`);
  }

  saveLogin(repo, { url, token: got.runner_token, agent_token: got.agent_token || undefined, workspace: got.workspace.name });
  console.log(`\nSigned in to ${got.workspace.name} (${repo}) at ${url}.\nSaved in ${credentialsFile()}${got.agent_token ? "" : "; `hq runner` also needs an agent token (HQ_AGENT_TOKEN)"}.`);
  return { url, token: got.runner_token, agent_token: got.agent_token || undefined, workspace: got.workspace.name, source: "saved" };
}
