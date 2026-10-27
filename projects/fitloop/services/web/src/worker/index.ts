// The FitLoop site's Worker: the web app's pages (./dist, built by Vite), the API the web app, the
// iPhone app and the glasses plugin use (/api/*), and the MCP server at /mcp for the user's own agent
// with the OAuth 2.1 authorization server that guards it (@cloudflare/workers-oauth-provider, as in
// the other HEJI Workers). The Supabase project is shared by every HEJI app, so its built-in OAuth
// server isn't used; server code with the service key runs here.
//
//   /mcp                          MCP (Streamable HTTP); OAuth access token or an `fla_…` token
//   /.well-known/…, /token, /register   handled by the provider
//   GET  /authorize               starts consent, then redirects to the consent page /oauth/consent/
//   POST /authorize               the consent page approves or denies, with the user's Supabase session
//   GET/DELETE /api/grants        connected assistants (signed-in user)
//   /api/*                        api.ts
//   everything else               static assets

import { AuthorizationError, OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { handleApi } from "./api.ts";
import { handleMcp, type Caller } from "./mcp.ts";
import { admin, json, PREFIX, resolveAgent, supabaseUser, type Env as BaseEnv } from "./store.ts";

export interface Env extends BaseEnv {
  OAUTH_PROVIDER: OAuthHelpers;
}

interface Props {
  userId: string;
  via: "oauth" | "token";
}

const mcpHandler = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & { props?: Props }): Promise<Response> {
    const props = ctx.props;
    if (!props?.userId) return new Response("unauthorized", { status: 401 });
    const caller: Caller = { userId: props.userId, via: props.via };
    return handleMcp(req, caller, admin(env), env.PUBLIC_URL);
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
    const props: Props = { userId: user.id, via: "oauth" };
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

async function grants(req: Request, env: Env, url: URL): Promise<Response> {
  const user = await supabaseUser(env, req);
  if (!user) return json({ error: "sign in required" }, 401);
  const oauth = env.OAUTH_PROVIDER;
  if (req.method === "GET" && url.pathname === "/api/grants") {
    const { items } = await oauth.listUserGrants(user.id);
    const rows = await Promise.all(items.map(async (g) => {
      const client = await oauth.lookupClient(g.clientId).catch(() => null);
      return { id: g.id, client_name: client?.clientName ?? null, created_at: new Date(g.createdAt * 1000).toISOString() };
    }));
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
    if (url.pathname === "/api/account" && req.method === "DELETE") {
      // Deleting FitLoop's data also disconnects every agent.
      const user = await supabaseUser(env, req);
      if (user) {
        const { items } = await env.OAUTH_PROVIDER.listUserGrants(user.id);
        await Promise.all(items.map((g) => env.OAUTH_PROVIDER.revokeGrant(g.id, user.id)));
      }
    }
    if (url.pathname.startsWith("/api/")) return handleApi(req, env, url);
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
    resourceMetadata: { resource, authorization_servers: [env.PUBLIC_URL], resource_name: "FitLoop" },
    accessTokenTTL: 3600,
    refreshTokenTTL: 90 * 86400,
    // Agents that can't do OAuth use fla_… tokens from the app or the web settings page.
    resolveExternalToken: async ({ token, env: e }) => {
      if (!token.startsWith(PREFIX.agent)) return null;
      const userId = await resolveAgent(admin(e as Env), token);
      if (!userId) return null;
      const props: Props = { userId, via: "token" };
      return { props, audience: resource };
    },
  });
  return provider;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => getProvider(env).fetch(req, env, ctx),
} satisfies ExportedHandler<Env>;
