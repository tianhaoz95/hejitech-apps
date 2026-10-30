// The Trading Plan Board's Worker: the portal's pages (./dist, built by Vite), the owner's API, the
// Board MCP for discussion agents with the OAuth 2.1 server that guards it
// (@cloudflare/workers-oauth-provider, as in the other HEJI Workers), the executor's API, and a
// cron that applies the time rules every minute. It never holds a Robinhood credential (§5.2.4).
//
//   /mcp                              Board MCP: OAuth access token or a `tba_…` agent token
//   /.well-known/…, /token, /register handled by the provider
//   GET/POST /authorize               consent for an agent, with the owner's session cookie
//   /api/auth/begin|verify|logout     owner sign-in (Supabase account + TOTP) → session cookie
//   /api/executor/*                   executor.ts, `tbx_…` credential only
//   /api/*                            portal.ts, the owner's session cookie only
//   /plans/<id>                       the plan page
//   scheduled (every minute)          sweep: expiry, staleness, approval and claim expiry

import { AuthorizationError, OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { authBegin, authLogout, authVerify, ownerSession, sameOrigin } from "./auth.ts";
import { handleExecutor } from "./executor.ts";
import { handleMcp } from "./mcp.ts";
import { GRANT_USER, handlePortal } from "./portal.ts";
import { admin, bearer, json, PREFIX, problem, rateLimit, sha256, sweep, type Env as BaseEnv } from "./store.ts";

export interface Env extends BaseEnv {
  OAUTH_PROVIDER: OAuthHelpers;
}

interface Props {
  agentId: string;
  via: "oauth" | "token";
}

const mcpHandler = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & { props?: Props }): Promise<Response> {
    const props = ctx.props;
    if (!props?.agentId) return new Response("unauthorized", { status: 401 });
    const db = admin(env);
    // A revoked agent loses OAuth grants and tokens at once, even before the grant is cleaned up.
    const { data: agent } = await db.from("agents").select("agent_id").eq("agent_id", props.agentId).is("revoked_at", null).maybeSingle();
    if (!agent) return json({ error_code: "agent_revoked", message: "this agent's access was revoked by the owner" }, 403);
    const limit = Number(env.AGENT_RATE_PER_MIN ?? 60) || 60;
    if (req.method === "POST" && !(await rateLimit(env.OAUTH_KV, `agent:${props.agentId}`, limit, 60))) {
      return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: `rate_limited: at most ${limit} calls a minute`, data: { error_code: "rate_limited" } } }, 429);
    }
    return handleMcp(req, { type: "agent", id: props.agentId }, db);
  },
};

async function authorize(req: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  try {
    if (req.method === "GET") {
      const authReq = await oauth.parseAuthRequest(req);
      const d = await oauth.describeConsent(authReq);
      const consent = await oauth.beginConsent(authReq);
      const page = new URL("/oauth/consent/", req.url);
      page.searchParams.set("handle", consent.handle);
      page.searchParams.set("client", d.clientName);
      if (d.clientDomain) page.searchParams.set("domain", d.clientDomain);
      page.searchParams.set("redirect_host", d.redirectHost);
      if (d.redirectIsLoopback) page.searchParams.set("loopback", "1");
      consent.headers.set("Location", page.toString());
      consent.headers.set("Cache-Control", "no-store");
      return new Response(null, { status: 302, headers: consent.headers });
    }
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    if (!sameOrigin(env, req)) return problem(403, "forbidden", "cross-site request refused");
    const body = (await req.json().catch(() => ({}))) as { handle?: string; decision?: string; agent_id?: string };
    const handle = String(body.handle ?? "");
    if (body.decision === "deny") {
      const denied = await oauth.denyConsent(req, handle);
      return json({ redirectTo: denied.headers.get("Location") }, 200, withoutLocation(denied.headers));
    }
    if (body.decision !== "approve") return json({ error: "decision must be approve or deny" }, 400);
    const db = admin(env);
    if (!(await ownerSession(env, db, req))) return json({ error: "Your session expired. Sign in again." }, 401);
    // The owner names the agent this connection speaks as; every comment it writes carries that id.
    const agentId = String(body.agent_id ?? "");
    const { data: agent } = await db.from("agents").select("agent_id").eq("agent_id", agentId).is("revoked_at", null).maybeSingle();
    if (!agent) return json({ error: "Pick a registered agent (Agents page) for this connection." }, 422);
    const approved = await oauth.approveConsent(req, handle, { scope: ["mcp"] });
    const props: Props = { agentId, via: "oauth" };
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request, userId: GRANT_USER, metadata: { agent_id: agentId }, scope: approved.request.scope, props,
    });
    await db.rpc("audit", { p_actor_type: "human", p_actor_id: "owner", p_action: "grant.issued", p_plan_id: null, p_details: { agent_id: agentId } });
    return json({ redirectTo }, 200, approved.headers);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (req.method === "GET" && error.redirectTo) return Response.redirect(error.redirectTo, 302);
      const page = new URL("/oauth/consent/", req.url);
      page.searchParams.set("error", error.description ?? "This request is invalid or expired.");
      return req.method === "GET" ? Response.redirect(page.toString(), 302) : json({ error: page.searchParams.get("error"), redirectTo: error.redirectTo ?? null }, 400);
    }
    throw error;
  }
}

function withoutLocation(headers: Headers): Headers {
  const h = new Headers(headers);
  h.delete("Location");
  return h;
}

const security = {
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};

function harden(res: Response): Response {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(security)) r.headers.set(k, v);
  return r;
}

const app = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    if (path === "/authorize") return harden(await authorize(req, env));

    if (path.startsWith("/api/executor/")) {
      const token = bearer(req);
      if (!token.startsWith(PREFIX.executor)) return problem(403, "forbidden", "executor credential required");
      const db = admin(env);
      const { data } = await db.rpc("resolve_executor_token", { p_token_hash: await sha256(token) });
      const row = Array.isArray(data) ? (data[0] as { executor_id: string } | undefined) : undefined;
      if (!row) return problem(401, "unauthorized", "unknown or revoked executor credential");
      return handleExecutor(req, db, row.executor_id, url);
    }

    if (path.startsWith("/api/")) {
      // Bearer credentials (agent tokens, executor credentials) never reach the owner's API (§7.3).
      if (req.headers.get("Authorization")) return problem(403, "forbidden", "the portal API takes the owner's session only");
      if (!sameOrigin(env, req)) return problem(403, "forbidden", "cross-site request refused");
      if (path === "/api/auth/begin" && req.method === "POST") return authBegin(req, env);
      if (path === "/api/auth/verify" && req.method === "POST") return authVerify(req, env);
      if (path === "/api/auth/logout" && req.method === "POST") return authLogout(req, env);
      const db = admin(env);
      if (!(await ownerSession(env, db, req))) return problem(401, "signin_required", "sign in");
      return handlePortal(req, env, db, url, env.OAUTH_PROVIDER);
    }

    if (/^\/plans\/[0-9a-f-]{36}\/?$/.test(path)) return harden(await env.ASSETS.fetch(new Request(new URL("/plan/", url), req)));
    return harden(await env.ASSETS.fetch(req));
  },
};

let provider: OAuthProvider<Env> | null = null;
let providerFor = "";

/** Built lazily: the resource URL comes from env (differs per environment). */
function getProvider(env: Env): OAuthProvider<Env> {
  if (provider && providerFor === env.PUBLIC_URL) return provider;
  const resource = `${env.PUBLIC_URL}/mcp`;
  providerFor = env.PUBLIC_URL;
  provider = new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: mcpHandler as never,
    defaultHandler: app as never,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    scopesSupported: ["mcp", "offline_access"],
    requiredScopes: ["mcp"],
    resourceMetadata: { resource, authorization_servers: [env.PUBLIC_URL], resource_name: "Trading Plan Board" },
    accessTokenTTL: 3600,
    refreshTokenTTL: 30 * 86400,
    // Agents that can't do OAuth use per-agent `tba_…` tokens the owner issues on the Agents page.
    resolveExternalToken: async ({ token, env: e }) => {
      if (!token.startsWith(PREFIX.agent)) return null;
      const { data } = await admin(e as Env).rpc("resolve_agent_token", { p_token_hash: await sha256(token) });
      const row = Array.isArray(data) ? (data[0] as { agent_id: string } | undefined) : undefined;
      if (!row) return null;
      const props: Props = { agentId: row.agent_id, via: "token" };
      return { props, audience: resource };
    },
  });
  return provider;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => getProvider(env).fetch(req, env, ctx),
  scheduled: (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(sweep(admin(env)).then((r) => console.log("sweep", JSON.stringify(r))));
  },
} satisfies ExportedHandler<Env>;
