// HQ's Worker: the portal (Vite-built pages in ./dist), the API (/api/*) for people (Supabase
// sessions) and runners/agents (workspace tokens), the MCP server at /mcp guarded by OAuth 2.1
// (@cloudflare/workers-oauth-provider) and workspace tokens, and the hourly cron that enqueues due
// scouts, the CEO and health checks in every workspace.
import { AuthorizationError, OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { can } from "@hq/core";
import { bearer, handleApi, json } from "./api.ts";
import { handleMcp } from "./mcp.ts";
import { admin, audit, memberRole, resolveToken, scheduleAll, supabaseUser, type Ctx, type Env as BaseEnv } from "./store.ts";

export interface Env extends BaseEnv {
  OAUTH_PROVIDER: OAuthHelpers;
}

/** What an OAuth grant carries: the agent acts in one workspace, approved by one member. */
interface Props {
  workspaceId: string;
  name: string;
  userId: string;
}

const ctx = (env: Env): Ctx => ({ env, db: admin(env) });

const mcpHandler = {
  async fetch(req: Request, env: Env, ec: ExecutionContext & { props?: Props }): Promise<Response> {
    const p = ec.props;
    if (!p?.workspaceId) return new Response("unauthorized", { status: 401 });
    // The person who connected the agent must still be allowed to: leaving or losing the role ends it.
    const role = await memberRole(ctx(env), p.workspaceId, p.userId);
    if (!role || !can(role, "connect_agent")) return json({ error: "invalid_token", error_description: "the member who connected this agent no longer can" }, 401);
    return handleMcp(req, { role: "agent", name: p.name, workspaceId: p.workspaceId }, env);
  },
};

function withoutLocation(headers: Headers): Headers {
  const h = new Headers(headers);
  h.delete("Location");
  return h;
}

/** OAuth consent for MCP clients: a member who may connect agents picks the workspace and approves. */
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
    const body = (await req.json().catch(() => ({}))) as { handle?: string; decision?: string; workspace?: string };
    const handle = String(body.handle ?? "");
    if (body.decision === "deny") {
      const denied = await oauth.denyConsent(req, handle);
      return json({ redirectTo: denied.headers.get("Location") }, 200, withoutLocation(denied.headers));
    }
    if (body.decision !== "approve") return json({ error: "decision must be approve or deny" }, 400);
    const user = await supabaseUser(env, bearer(req));
    if (!user) return json({ error: "Your session expired. Sign in again." }, 401);
    const workspaceId = String(body.workspace ?? "");
    const role = await memberRole(ctx(env), workspaceId, user.id);
    if (!role || !can(role, "connect_agent")) return json({ error: "Only an admin or approver of that workspace can connect an agent." }, 403);
    const approved = await oauth.approveConsent(req, handle, { scope: ["mcp"] });
    const clientName = (await oauth.lookupClient(approved.request.clientId).catch(() => null))?.clientName ?? "MCP client";
    const props: Props = { workspaceId, name: clientName, userId: user.id };
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: user.id,
      metadata: { client: clientName, workspace: workspaceId },
      scope: approved.request.scope,
      props,
    });
    await audit(ctx(env), { role, name: user.email ?? user.id, workspaceId, userId: user.id }, "oauth.grant", clientName);
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

/** The signed-in person's connected agents (OAuth grants), across their workspaces. */
async function grants(req: Request, env: Env, url: URL): Promise<Response> {
  const user = await supabaseUser(env, bearer(req));
  if (!user) return json({ error: "sign in required" }, 401);
  const oauth = env.OAUTH_PROVIDER;
  if (req.method === "GET" && url.pathname === "/api/grants") {
    const { items } = await oauth.listUserGrants(user.id);
    const rows = await Promise.all(
      items.map(async (g) => ({
        id: g.id,
        client_name: (await oauth.lookupClient(g.clientId).catch(() => null))?.clientName ?? null,
        workspace: (g.metadata as { workspace?: string } | undefined)?.workspace ?? null,
        created_at: new Date(g.createdAt * 1000).toISOString(),
      }))
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

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" };

const app = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/authorize") return authorize(req, env);
    if (url.pathname === "/api/grants" || url.pathname.startsWith("/api/grants/")) return grants(req, env, url);
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
      return handleApi(req, env, url);
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
  });
  return provider;
}

/**
 * Workspace tokens (hq_agt_…, hq_run_…) are checked against HQ's tables directly, so they work at
 * any address this Worker is reached by. OAuth access tokens go through the provider (PUBLIC_URL).
 */
async function ownTokenMcp(req: Request, env: Env): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname !== "/mcp" && !url.pathname.startsWith("/mcp/")) return null;
  const t = bearer(req);
  if (!t.startsWith("hq_agt_") && !t.startsWith("hq_run_")) return null;
  const caller = await resolveToken(ctx(env), t);
  if (!caller) return json({ error: "invalid_token", error_description: "unknown or revoked HQ token" }, 401);
  return handleMcp(req, caller, env);
}

export default {
  fetch: async (req: Request, env: Env, ec: ExecutionContext) => (await ownTokenMcp(req, env)) ?? getProvider(env).fetch(req, env, ec),
  scheduled: async (_event: ScheduledController, env: Env, ec: ExecutionContext) => {
    ec.waitUntil(scheduleAll(ctx(env)).then((r) => console.log("schedule", JSON.stringify(r))));
  },
} satisfies ExportedHandler<Env>;
