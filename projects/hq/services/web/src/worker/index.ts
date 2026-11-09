// HQ's Worker: the portal (Vite-built pages in ./dist), the API (/api/*) for the portal, the iOS app
// and runners, the MCP server at /mcp guarded by OAuth 2.1 (@cloudflare/workers-oauth-provider) and
// tokens (`hq_agt_…`, `hq_run_…`), and the hourly cron that enqueues due scouts, the CEO and health.
//
// HQ is single-tenant: one owner per deployment, identified by the HQ_OWNER_TOKEN secret.
import { AuthorizationError, OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { handleApi, json } from "./api.ts";
import { handleMcp } from "./mcp.ts";
import { audit, resolveToken, safeEqual, schedule, type Caller, type Env as BaseEnv } from "./store.ts";

export interface Env extends BaseEnv {
  OAUTH_PROVIDER: OAuthHelpers;
}

interface Props {
  role: "agent" | "runner";
  name: string;
}

const bearer = (req: Request) => req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";

async function callerFor(req: Request, env: Env): Promise<Caller | null> {
  const t = bearer(req);
  if (!t) return null;
  if (env.HQ_OWNER_TOKEN && safeEqual(t, env.HQ_OWNER_TOKEN)) return { role: "owner", name: "owner" };
  return resolveToken(env, t);
}

const mcpHandler = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & { props?: Props }): Promise<Response> {
    const p = ctx.props;
    if (!p?.role) return new Response("unauthorized", { status: 401 });
    return handleMcp(req, { role: p.role, name: p.name }, env);
  },
};

function withoutLocation(headers: Headers): Headers {
  const h = new Headers(headers);
  h.delete("Location");
  return h;
}

/** OAuth consent for MCP clients: the portal's consent page approves with the owner's token. */
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
    const caller = await callerFor(req, env);
    if (caller?.role !== "owner") return json({ error: "Only HQ's owner can connect an agent. Sign in with the owner token first." }, 401);
    const approved = await oauth.approveConsent(req, handle, { scope: ["mcp"] });
    const clientName = (await oauth.lookupClient(approved.request.clientId).catch(() => null))?.clientName ?? "MCP client";
    const props: Props = { role: "agent", name: clientName };
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: "owner",
      metadata: { client: clientName },
      scope: approved.request.scope,
      props,
    });
    await audit(env, caller, "oauth.grant", clientName);
    return json({ redirectTo }, 200, approved.headers);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (req.method === "GET" && error.redirectTo) return Response.redirect(error.redirectTo, 302);
      const problem = new URL("/oauth/consent/", req.url);
      problem.searchParams.set("error", error.description ?? "This request is invalid or expired.");
      return req.method === "GET"
        ? Response.redirect(problem.toString(), 302)
        : json({ error: problem.searchParams.get("error"), redirectTo: error.redirectTo ?? null }, 400);
    }
    throw error;
  }
}

async function grants(req: Request, env: Env, url: URL): Promise<Response> {
  const caller = await callerFor(req, env);
  if (caller?.role !== "owner") return json({ error: "owner only" }, 401);
  const oauth = env.OAUTH_PROVIDER;
  if (req.method === "GET" && url.pathname === "/api/grants") {
    const { items } = await oauth.listUserGrants("owner");
    const rows = await Promise.all(
      items.map(async (g) => ({
        id: g.id,
        client_name: (await oauth.lookupClient(g.clientId).catch(() => null))?.clientName ?? null,
        created_at: new Date(g.createdAt * 1000).toISOString(),
      }))
    );
    return json(rows);
  }
  const m = url.pathname.match(/^\/api\/grants\/([^/]+)$/);
  if (req.method === "DELETE" && m) {
    await oauth.revokeGrant(decodeURIComponent(m[1]), "owner");
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
}

const app = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/authorize") return authorize(req, env);
    if (url.pathname === "/api/grants" || url.pathname.startsWith("/api/grants/")) return grants(req, env, url);
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS" } });
      return handleApi(req, env, url, await callerFor(req, env));
    }
    return env.ASSETS.fetch(req);
  },
};

let provider: OAuthProvider<Env> | null = null;
let providerFor = "";

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
    resourceMetadata: { resource, authorization_servers: [env.PUBLIC_URL], resource_name: "HQ" },
    accessTokenTTL: 3600,
    refreshTokenTTL: 90 * 86400,
    resolveExternalToken: async ({ token, env: e }) => {
      const caller = await resolveToken(e as Env, token);
      if (!caller || caller.role === "owner") return null;
      const props: Props = { role: caller.role, name: caller.name };
      return { props, audience: resource };
    },
  });
  return provider;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => getProvider(env).fetch(req, env, ctx),
  scheduled: async (_event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(schedule(env).then((r) => console.log("schedule", JSON.stringify(r))));
  },
} satisfies ExportedHandler<Env>;
