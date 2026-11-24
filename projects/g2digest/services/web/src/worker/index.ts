// The G2 Digest site's Worker: the web app's pages (./dist, built by Vite), the API the web app and
// the glasses plugin use (/api/*), the private podcast feed (/feed/*) and the MCP server at /mcp
// with the OAuth 2.1 authorization server that guards it (@cloudflare/workers-oauth-provider, as in
// the other HEJI Workers). The Supabase project is shared by every HEJI app, so its built-in OAuth
// server isn't used, and there are no Edge Functions: server code with the service key runs here.
//
//   /mcp                          MCP (Streamable HTTP); OAuth access token or a `g2a_…` token
//   /.well-known/…, /token, /register   handled by the provider
//   GET  /authorize               starts consent, then redirects to the consent page /oauth/consent/
//   POST /authorize               the consent page approves or denies, with the user's Supabase session
//   GET/DELETE /api/grants        connected assistants (signed-in user)
//   DELETE /api/account           delete all of the signed-in user's G2 Digest data
//   /api/*, /feed/*               api.ts
//   /edition/<date>, /preview/<date>   the edition and preview pages
//   everything else               static assets

import { AuthorizationError, OAuthProvider, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { notifyEdition, notifyMissedDelivery } from "./push.ts";
import { handleApi } from "./api.ts";
import { handleNotification } from "./appstore.ts";
import { handleStripeWebhook, proRequired, proStatus } from "./billing.ts";
import { handleMcp, type Caller } from "./mcp.ts";
import { admin, checkDeliveryStatus, deleteUserData, json, loadBrief, PREFIX, promoteDueEditions, sha256, supabaseUser, type Env as BaseEnv } from "./store.ts";

export interface Env extends BaseEnv {
  OAUTH_PROVIDER: OAuthHelpers;
}

interface Props {
  userId: string;
  via: "oauth" | "token";
  agentName?: string;
}

const mcpHandler = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext & { props?: Props }): Promise<Response> {
    const props = ctx.props;
    if (!props?.userId) return new Response("unauthorized", { status: 401 });
    const caller: Caller = { userId: props.userId, via: props.via, agentName: props.agentName };
    const db = admin(env);
    // Assistants need Pro, like the web and the glasses (billing.ts).
    const email = (await db.auth.admin.getUserById(props.userId).catch(() => null))?.data.user?.email;
    if (!(await proStatus(db, props.userId, email)).pro) return json(proRequired(env), 402);
    return handleMcp(req, caller, db, env.OAUTH_KV, (userId, e) => notifyEdition(env, db, userId, e));
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

/** Everything G2 Digest holds for the signed-in user, and the assistants they connected. */
async function deleteAccount(req: Request, env: Env): Promise<Response> {
  const user = await supabaseUser(env, req);
  if (!user) return json({ error: "sign in required" }, 401);
  const { items } = await env.OAUTH_PROVIDER.listUserGrants(user.id);
  for (const g of items) await env.OAUTH_PROVIDER.revokeGrant(g.id, user.id);
  try {
    await deleteUserData(admin(env), user.id);
  } catch {
    return json({ error: "Couldn't delete everything. Try again, or email us." }, 500);
  }
  return json({ ok: true });
}

const app = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/authorize") return authorize(req, env);
    if (url.pathname === "/api/grants" || url.pathname.startsWith("/api/grants/")) return grants(req, env, url);
    if (url.pathname === "/api/account" && req.method === "DELETE") return deleteAccount(req, env);
    // The stores tell us about renewals, cancellations and refunds (billing.ts, appstore.ts).
    if (url.pathname === "/stripe/webhook" && req.method === "POST") return handleStripeWebhook(env, admin(env), req);
    if (url.pathname === "/appstore/notifications" && req.method === "POST") {
      const r = await handleNotification(admin(env), await req.json().catch(() => null));
      console.log("appstore notification", r.result);
      return json({ ok: r.status < 300, result: r.result }, r.status);
    }
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/feed/")) return handleApi(req, env, url);
    // Pretty routes for one date: the page reads the date from location.pathname.
    const page = url.pathname.match(/^\/(edition|preview)\/(?:\d{4}-\d{2}-\d{2}|latest|fixture)\/?$/);
    if (page) return env.ASSETS.fetch(new Request(new URL(`/${page[1]}/`, url), req));
    if (url.pathname.startsWith("/share/")) return env.ASSETS.fetch(new Request(new URL("/share/", url), req));
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
    resourceMetadata: { resource, authorization_servers: [env.PUBLIC_URL], resource_name: "G2 Digest" },
    accessTokenTTL: 3600,
    refreshTokenTTL: 90 * 86400,
    // Build agents that can't do OAuth (a cron job, another vendor's agent) use g2a_… tokens from the web app.
    resolveExternalToken: async ({ token, env: e }) => {
      if (!token.startsWith(PREFIX.agent)) return null;
      const db = admin(e as Env);
      const { data } = await db.rpc("resolve_access_token", { p_token_hash: await sha256(token) });
      const row = Array.isArray(data) ? (data[0] as { token_id?: string; user_id: string } | undefined) : undefined;
      if (!row) return null;
      let agentName: string | undefined;
      if (row.token_id) {
        const { data: tok } = await db.from("access_tokens").select("name").eq("id", row.token_id).maybeSingle();
        if (tok?.name) agentName = String(tok.name);
      }
      const props: Props = { userId: row.user_id, via: "token", agentName };
      return { props, audience: resource };
    },
  });
  return provider;
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => getProvider(env).fetch(req, env, ctx),
  async scheduled(_controller: ScheduledController, env: Env) {
    const db = admin(env);
    const promoted = await promoteDueEditions(db);
    for (const e of promoted) {
      await notifyEdition(env, db, e.user_id, {
        date: e.date,
        title: e.title,
        cards: e.cards,
        lead_title: e.lead_title,
        alert_count: e.alert_count,
      }).catch(() => undefined);
    }
    // Check for missed deliveries for users who have push devices registered.
    const [{ data: apnsUsers }, { data: fcmUsers }] = await Promise.all([
      db.from("push_devices").select("user_id"),
      db.from("fcm_devices").select("user_id"),
    ]);
    const userIds = [...new Set([
      ...((apnsUsers ?? []) as { user_id: string }[]).map((r) => r.user_id),
      ...((fcmUsers ?? []) as { user_id: string }[]).map((r) => r.user_id),
    ])];
    for (const userId of userIds) {
      try {
        const [{ brief }, { data: latest }] = await Promise.all([
          loadBrief(db, userId),
          db.from("editions").select("date").eq("user_id", userId).eq("status", "published").order("date", { ascending: false }).limit(1),
        ]);
        const latestDate = ((latest ?? [])[0] as { date?: string } | undefined)?.date ?? null;
        // Only alert users who have published at least once (avoid nagging before setup finishes).
        if (!latestDate) continue;
        const status = checkDeliveryStatus(brief, latestDate);
        if (!status.missed) continue;
        const kvKey = `missed:${userId}:${status.expected_date}`;
        if (await env.OAUTH_KV.get(kvKey)) continue;
        await notifyMissedDelivery(env, db, userId, status);
        await env.OAUTH_KV.put(kvKey, "1", { expirationTtl: 86400 });
      } catch {
        /* best effort per user */
      }
    }
  },
} satisfies ExportedHandler<Env>;
