// The Wee Hours site's Worker: static pages (./dist, built by Vite) plus the MCP server at /mcp and
// the OAuth 2.1 authorization server that guards it (@cloudflare/workers-oauth-provider, as in
// Waypack's Worker). The Supabase project is shared by every HEJI app, so its built-in OAuth server
// (one consent URL per project) is not used: this Worker issues its own grants.
//
//   /mcp                     MCP (Streamable HTTP); OAuth access token or a `wh_…` access token
//   /.well-known/…, /token, /register   handled by the provider
//   GET  /authorize          starts consent, then redirects to the consent page /oauth/consent/
//   POST /authorize          the consent page approves or denies, with the user's Supabase session
//   GET/DELETE /api/grants   the account page lists and revokes connected assistants
//   everything else          static assets

import { AuthorizationError, OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { createClient } from "@supabase/supabase-js";
import { handleMcp, type Caller, type Db } from "./mcp.ts";

export interface Env {
  OAUTH_KV: KVNamespace;
  ASSETS: Fetcher;
  OAUTH_PROVIDER: OAuthHelpers;
  /** This site's origin; the MCP resource is `${PUBLIC_URL}/mcp`. */
  PUBLIC_URL: string;
  SUPABASE_URL: string;
  /** Publishable (anon) key: validates users' Supabase sessions. */
  SUPABASE_ANON_KEY: string;
  /** Secret. Server-side only; bypasses RLS for every project in the shared Supabase project. */
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/** Stored on each OAuth grant. The household is looked up per request: a user can switch households. */
interface Props {
  userId: string;
  scope: "read" | "write";
  via: "oauth" | "token";
  householdId?: string;
}

const SCHEMA = "weehours";

function admin(env: Env): Db {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: SCHEMA } });
}

async function householdOf(db: Db, userId: string): Promise<string | null> {
  const { data } = await db.from("members").select("household_id").eq("user_id", userId).maybeSingle();
  return (data?.household_id as string | undefined) ?? null;
}

/** The Supabase user behind a session access token (from the site's supabase-js), or null. */
async function supabaseUser(env: Env, req: Request): Promise<{ id: string; email?: string } | null> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string };
  return { id: u.id, email: u.email };
}

const json = (body: unknown, status = 200, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");
  h.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
};

const mcpHandler = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & { props?: Props }): Promise<Response> {
    const props = ctx.props;
    if (!props?.userId) return new Response("unauthorized", { status: 401 });
    const db = admin(env);
    const householdId = props.householdId ?? (await householdOf(db, props.userId));
    if (!householdId) {
      return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "this account has no household yet: set one up in the Wee Hours app" } }, 403);
    }
    const caller: Caller = { userId: props.userId, householdId, scope: props.scope, via: props.via };
    return handleMcp(req, caller, db);
  },
};

/**
 * GET: validates the client's request and hands the browser to the consent page. The display
 * details travel in the URL only for showing; what gets approved is the request bound to `handle`
 * (and to this browser by the provider's cookie).
 */
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

    const body = (await req.json().catch(() => ({}))) as { handle?: string; decision?: string };
    const handle = String(body.handle ?? "");
    if (body.decision === "deny") {
      const denied = await oauth.denyConsent(req, handle);
      return json({ redirectTo: denied.headers.get("Location") }, 200, withoutLocation(denied.headers));
    }
    if (body.decision !== "approve") return json({ error: "decision must be approve or deny" }, 400);

    const user = await supabaseUser(env, req);
    if (!user) return json({ error: "Your session expired. Sign in again." }, 401);
    const approved = await oauth.approveConsent(req, handle, { scope: ["mcp"] });
    const props: Props = { userId: user.id, scope: "write", via: "oauth" };
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: user.id,
      metadata: { email: user.email },
      scope: approved.request.scope,
      props,
    });
    return json({ redirectTo }, 200, approved.headers);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (req.method === "GET" && error.redirectTo) return Response.redirect(error.redirectTo, 302);
      const problem = new URL("/oauth/consent/", req.url);
      problem.searchParams.set("error", error.description ?? "This request is invalid or expired.");
      return req.method === "GET" ? Response.redirect(problem.toString(), 302) : json({ error: problem.searchParams.get("error"), redirectTo: error.redirectTo ?? null }, 400);
    }
    throw error;
  }
}

function withoutLocation(headers: Headers): Headers {
  const h = new Headers(headers);
  h.delete("Location");
  return h;
}

/** Connected assistants for the account page (the signed-in user's grants). */
async function grants(req: Request, env: Env, url: URL): Promise<Response> {
  const user = await supabaseUser(env, req);
  if (!user) return json({ error: "sign in required" }, 401);
  const oauth = env.OAUTH_PROVIDER;
  if (req.method === "GET" && url.pathname === "/api/grants") {
    const { items } = await oauth.listUserGrants(user.id);
    const rows = await Promise.all(
      items.map(async (g) => {
        const client = await oauth.lookupClient(g.clientId).catch(() => null);
        return { id: g.id, client_name: client?.clientName ?? null, client_uri: client?.clientUri ?? null, created_at: new Date(g.createdAt * 1000).toISOString() };
      }),
    );
    return json(rows);
  }
  const m = url.pathname.match(/^\/api\/grants\/([^/]+)$/);
  if (req.method === "DELETE" && m) {
    await oauth.revokeGrant(decodeURIComponent(m[1]), user.id);
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
}

const app = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/authorize") return authorize(req, env);
    if (url.pathname === "/api/grants" || url.pathname.startsWith("/api/grants/")) return grants(req, env, url);
    return env.ASSETS.fetch(req);
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
    resourceMetadata: { resource, authorization_servers: [env.PUBLIC_URL], resource_name: "Wee Hours" },
    accessTokenTTL: 3600,
    refreshTokenTTL: 90 * 86400,
    // Agents that can't do OAuth use personal access tokens from the app (only hashes are stored).
    resolveExternalToken: async ({ token, env: e }) => {
      if (!token.startsWith("wh_")) return null;
      const { data } = await admin(e as Env).rpc("resolve_access_token", { p_token: token });
      const row = Array.isArray(data) ? (data[0] as { user_id: string; household_id: string; scope: "read" | "write" } | undefined) : undefined;
      if (!row) return null;
      const props: Props = { userId: row.user_id, householdId: row.household_id, scope: row.scope, via: "token" };
      return { props, audience: resource };
    },
  });
  return provider;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => getProvider(env).fetch(req, env, ctx),
} satisfies ExportedHandler<Env>;
