// The official Robinhood MCP (https://agent.robinhood.com/mcp/trading) as a Brokerage, through the
// MCP TypeScript SDK with Robinhood's OAuth on a loopback redirect (§10): discovery, dynamic client
// registration, PKCE and token refresh are the SDK's; the tokens live in robinhood-oauth.json (0600)
// on this machine only. The daemon never opens a browser: when a sign-in is needed it reports
// "run `tradeboard-executor auth`" as its error on the portal.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { paths, readJson, writeSecret, type Config } from "./config.ts";
import {
  findArray, findKey, num, parseOrder, parseQuote, unwrap, UncertainError, type Account, type Brokerage, type OrderRead, type Placed, type Review, type RhOrderRequest,
} from "./brokerage.ts";

interface Stored {
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  verifier?: string;
}

export class SignInNeeded extends Error {}

/** OAuth state for the Robinhood MCP, in a 0600 file. `interactive` decides what a needed sign-in does. */
export class FileOAuthProvider implements OAuthClientProvider {
  private redirect: string;
  private onAuthorize: (url: URL) => void | Promise<void>;
  constructor(port: number, onAuthorize: (url: URL) => void | Promise<void>) {
    this.redirect = `http://127.0.0.1:${port}/oauth/callback`;
    this.onAuthorize = onAuthorize;
  }
  private read(): Stored {
    return readJson<Stored>(paths().oauth) ?? {};
  }
  private write(s: Stored) {
    writeSecret(paths().oauth, JSON.stringify(s, null, 2));
  }
  get redirectUrl() {
    return this.redirect;
  }
  get clientMetadata(): OAuthClientMetadata {
    return { client_name: "Trading Plan Board executor", redirect_uris: [this.redirect], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
  }
  clientInformation() {
    return this.read().client;
  }
  saveClientInformation(info: OAuthClientInformationMixed) {
    this.write({ ...this.read(), client: info });
  }
  tokens() {
    return this.read().tokens;
  }
  saveTokens(tokens: OAuthTokens) {
    this.write({ ...this.read(), tokens });
  }
  saveCodeVerifier(v: string) {
    this.write({ ...this.read(), verifier: v });
  }
  codeVerifier() {
    const v = this.read().verifier;
    if (!v) throw new Error("no PKCE verifier saved");
    return v;
  }
  async redirectToAuthorization(url: URL) {
    await this.onAuthorize(url);
  }
  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    const s = this.read();
    if (scope === "all") return this.write({});
    if (scope === "client") delete s.client;
    if (scope === "tokens") delete s.tokens;
    if (scope === "verifier") delete s.verifier;
    this.write(s);
  }
}

/** One-shot listener on the loopback redirect; resolves with the authorization code. */
function waitForCallback(port: number, timeoutMs = 10 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (u.pathname !== "/oauth/callback") {
        res.writeHead(404).end();
        return;
      }
      const code = u.searchParams.get("code");
      const err = u.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(code ? "<p>Robinhood connected. You can close this tab and go back to the terminal.</p>" : `<p>Robinhood sign-in failed: ${String(err ?? "no code").replace(/[<>&]/g, "")}</p>`);
      server.close();
      clearTimeout(timer);
      if (code) resolve(code);
      else reject(new Error(`Robinhood sign-in failed: ${err ?? "no code"}`));
    });
    const timer = setTimeout(() => { server.close(); reject(new Error("timed out waiting for the Robinhood sign-in")); }, timeoutMs);
    server.on("error", reject);
    server.listen(port, "127.0.0.1");
  });
}

function openBrowser(url: string): boolean {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return false;
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * `tradeboard-executor auth`: the loopback flow. Opens the Robinhood login in a browser (or prints the
 * URL when there's none, e.g. over SSH) and completes on http://127.0.0.1:<port>/oauth/callback.
 * Headless fallback: paste the full callback URL from the browser's address bar (it carries only the
 * one-time code, never a password).
 */
export async function interactiveSignIn(cfg: Config, log: (s: string) => void): Promise<void> {
  const port = cfg.robinhood.redirect_port;
  let authUrl: URL | null = null;
  const provider = new FileOAuthProvider(port, (u) => { authUrl = u; });
  const transport = new StreamableHTTPClientTransport(new URL(cfg.robinhood.mcp_url), { authProvider: provider });
  const client = new Client({ name: "tradeboard-executor", version: "0.1.0" });
  try {
    await client.connect(transport);
    log("Already signed in to Robinhood.");
    await client.close();
    return;
  } catch (e) {
    if (!(e instanceof UnauthorizedError) || !authUrl) throw e;
  }
  const url = (authUrl as URL).toString();
  const opened = openBrowser(url);
  log(opened ? "Opened the Robinhood sign-in in your browser." : "Open this URL in a browser and sign in to Robinhood:");
  log(url);
  log(`Waiting for the redirect to http://127.0.0.1:${port}/oauth/callback …`);
  log("No browser on this machine? Either forward the port (ssh -L " + port + ":127.0.0.1:" + port + " <this host>) before signing in, or paste the full URL the browser ends on here.");
  const viaListener = waitForCallback(port);
  const viaPaste = (async () => {
    if (!process.stdin.isTTY) return new Promise<string>(() => {});
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const line = await rl.question("Callback URL (or wait): ");
    rl.close();
    const code = new URL(line.trim()).searchParams.get("code");
    if (!code) throw new Error("that URL has no ?code=");
    return code;
  })();
  const code = await Promise.race([viaListener, viaPaste]);
  await transport.finishAuth(code);
  const again = new Client({ name: "tradeboard-executor", version: "0.1.0" });
  await again.connect(new StreamableHTTPClientTransport(new URL(cfg.robinhood.mcp_url), { authProvider: provider }));
  const tools = await again.listTools();
  await again.close();
  log(`Signed in. Robinhood MCP offers ${tools.tools.length} tools. Tokens are in ${paths().oauth} (mode 600).`);
}

/** The daemon's Robinhood connection. Reconnects on demand; a needed sign-in throws SignInNeeded. */
export function robinhood(cfg: Config, callTimeoutMs = 30_000): Brokerage & { connect(): Promise<void>; close(): Promise<void>; connected(): boolean } {
  let client: Client | null = null;
  const provider = new FileOAuthProvider(cfg.robinhood.redirect_port, () => { throw new SignInNeeded("Robinhood sign-in needed: run `tradeboard-executor auth` on the executor machine"); });

  async function connect() {
    if (client) return;
    const c = new Client({ name: "tradeboard-executor", version: "0.1.0" });
    try {
      await c.connect(new StreamableHTTPClientTransport(new URL(cfg.robinhood.mcp_url), { authProvider: provider }));
    } catch (e) {
      if (e instanceof UnauthorizedError || e instanceof SignInNeeded) throw new SignInNeeded("Robinhood sign-in needed (or the token refresh failed): run `tradeboard-executor auth`");
      throw e;
    }
    client = c;
  }

  /** A tool call. `uncertain` marks calls whose outcome matters if the reply is lost (placing). */
  async function call(name: string, args: Record<string, unknown>, uncertain = false): Promise<unknown> {
    await connect();
    let res;
    try {
      res = await client!.callTool({ name, arguments: args }, undefined, { timeout: callTimeoutMs });
    } catch (e) {
      client = null;
      if (e instanceof UnauthorizedError) throw new SignInNeeded("Robinhood sign-in needed: run `tradeboard-executor auth`");
      if (uncertain) throw new UncertainError(`${name}: ${(e as Error).message}`);
      throw e;
    }
    const content = (res.content ?? []) as { type: string; text?: string }[];
    const text = content.find((c) => c.type === "text")?.text ?? "";
    if (res.isError) throw new Error(`${name}: ${text.slice(0, 300)}`);
    if (res.structuredContent) return res.structuredContent;
    try {
      return JSON.parse(text);
    } catch {
      if (uncertain) throw new UncertainError(`${name}: unreadable reply`);
      throw new Error(`${name}: unreadable reply`);
    }
  }

  return {
    connect,
    connected: () => client !== null,
    close: async () => { await client?.close(); client = null; },

    async accounts(): Promise<Account[]> {
      const rows = findArray(unwrap(await call("get_accounts", {})), (o) => "account_number" in o);
      return rows.map((r) => ({ account_number: String(r.account_number), agentic_allowed: r.agentic_allowed === true }));
    },

    async quote(symbol) {
      return parseQuote(await call("get_equity_quotes", { symbols: [symbol] }), symbol);
    },

    async positionUsd(account, symbol, price) {
      const raw = unwrap(await call("get_equity_positions", { account_number: account }));
      const rows = findArray(raw, (o) => "quantity" in o || "shares" in o);
      if (!rows.length) {
        // An empty list is a real answer only when the reply says so explicitly.
        const list = findKey(raw, ["results", "positions"]);
        if (Array.isArray(list) && list.length === 0) return 0;
        throw new Error("positions reply unreadable");
      }
      let usd = 0;
      for (const r of rows) {
        const sym = (r.symbol ?? (r.instrument as Record<string, unknown> | undefined)?.symbol) as string | undefined;
        if (sym !== symbol) continue;
        const qty = num(r.quantity ?? r.shares) ?? 0;
        usd += num(r.market_value ?? r.equity) ?? qty * price;
      }
      return usd;
    },

    async tradeApprovals(account) {
      const raw = unwrap(await call("get_trade_approval_setting", { account_number: account }));
      const v = findKey(raw, ["trade_approvals_enabled", "approvals_enabled", "requires_approval", "approval_required", "enabled", "trade_approval_enabled"]);
      if (v === true) return "on";
      if (v === false) return "off";
      const s = typeof v === "string" ? v.toLowerCase() : typeof findKey(raw, ["setting", "status", "state"]) === "string" ? String(findKey(raw, ["setting", "status", "state"])).toLowerCase() : "";
      if (/^(on|enabled|required|true)$/.test(s)) return "on";
      if (/^(off|disabled|not_required|false)$/.test(s)) return "off";
      return "unknown";
    },

    async review(order): Promise<Review> {
      const raw = unwrap(await call("review_equity_order", { ...order }));
      const checks = findKey(raw, ["order_checks", "alerts"]);
      const alerts = Array.isArray(checks) ? checks.map((c) => (typeof c === "string" ? c : JSON.stringify(c)).slice(0, 200)) : [];
      return { customer_approval_required: findKey(raw, ["customer_approval_required"]) === true, alerts };
    },

    async place(order, refId): Promise<Placed> {
      const raw = unwrap(await call("place_equity_order", { ...order, ref_id: refId }, true));
      const id = findKey(raw, ["order_id", "id"]);
      const state = String(findKey(raw, ["state", "status"]) ?? "").toLowerCase();
      const proposal = findKey(raw, ["customer_approval_required"]) === true || /approval|proposed|pending_customer/.test(state);
      return { order_id: typeof id === "string" && id ? id : null, proposal };
    },

    async order(account, id): Promise<OrderRead | null> {
      const rows = findArray(unwrap(await call("get_equity_orders", { account_number: account, order_id: id })), (o) => "id" in o || "state" in o);
      const o = rows.map(parseOrder).find((r) => r.id === id);
      return o ?? null;
    },

    async recentOrders(account, symbol, sinceIso) {
      const rows = findArray(unwrap(await call("get_equity_orders", { account_number: account, symbol, created_at_gte: sinceIso, agent_initiated: true })), (o) => "id" in o);
      return rows.map(parseOrder);
    },
  };
}
