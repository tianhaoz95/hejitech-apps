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
import { derive, status, statusLine, validate, type LogEvent } from "@weehours/core";
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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Time-boxed Caregiver Pass (`/pass/<token>`): mobile web view for a babysitter or grandparent. */
async function caregiverPass(req: Request, env: Env, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/pass\/(wh_[A-Za-z0-9_-]+)(\/log)?$/);
  if (!m) return new Response("Not found", { status: 404 });
  const token = m[1];
  const isLog = m[2] === "/log";
  const db = admin(env);
  const { data } = await db.rpc("resolve_access_token", { p_token: token });
  const row = Array.isArray(data) ? (data[0] as { user_id: string; household_id: string; scope: "read" | "write" } | undefined) : undefined;
  if (!row) {
    return new Response(passHtml("Pass expired or revoked", `<div class="card"><p>This caregiver pass is no longer active. Ask the parents to share a new link from Wee Hours → Settings.</p></div>`),
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const { data: tokens } = await db.from("access_tokens").select("name, revoked_at").eq("household_id", row.household_id).is("revoked_at", null).order("last_used_at", { ascending: false }).limit(10);
  const passMeta = (tokens ?? []).map((t) => String(t.name ?? "")).find((n) => n.startsWith("pass:")) ?? "pass:Caregiver|0|";
  const [, rawBody = "Caregiver|0|"] = passMeta.split("pass:");
  const [sitterName = "Caregiver", expStr = "0", pinnedNote = ""] = rawBody.split("|");
  const expiresSec = Number(expStr) || 0;
  if (expiresSec > 0 && Date.now() / 1000 > expiresSec) {
    return new Response(passHtml("Pass expired", `<div class="card"><p>This caregiver pass for <b>${esc(sitterName)}</b> expired. Ask the parents for a fresh link if you're still on shift.</p></div>`),
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const { data: babies } = await db.from("babies").select("id, name, settings, archived_at").eq("household_id", row.household_id).order("position");
  const active = ((babies ?? []) as { id: string; name: string; settings: Record<string, unknown> | null; archived_at: string | null }[]).filter((b) => !b.archived_at);
  const children = active.length ? active : [{ id: "", name: "Baby", settings: null, archived_at: null }];

  if (req.method === "POST" && isLog && row.scope === "write") {
    const form = await req.formData();
    const type = String(form.get("type") ?? "");
    const babyId = String(form.get("baby") ?? children[0].id);
    const kind = String(form.get("kind") ?? "");
    const note = String(form.get("note") ?? "").trim();
    const fields: Record<string, string | number | boolean> = {};
    if (type === "diaper") fields.kind = kind || "wet";
    if (type === "feed.bottle.finish") fields.consumed_fraction = Number(form.get("fraction") ?? 1);
    if (type === "note" && note) fields.transcript = `[${sitterName}] ${note}`;
    if (type === "note" ? Boolean(note) : validate(type, fields) === null) {
      const now = new Date().toISOString();
      await db.from("events").insert({
        id: crypto.randomUUID(), household_id: row.household_id, baby_id: babyId, type, fields,
        occurred_at: now, logged_at: now, logged_by: row.user_id,
        provenance: { surface: "mcp", input: "tap", caller: `pass:${sitterName}` },
      });
    }
    return Response.redirect(`${url.origin}/pass/${token}?logged=1`, 303);
  }

  const { data: evRows } = await db.from("events").select("*").eq("household_id", row.household_id).order("seq", { ascending: false }).limit(300);
  const events = ((evRows ?? []) as LogEvent[]).reverse();
  const childId = url.searchParams.get("child") ?? children[0].id;
  const chosen = children.find((c) => c.id === childId) ?? children[0];
  const d = derive(events, chosen.id);
  const s = status(d);
  const line = statusLine(s, Date.now());
  const expText = expiresSec > 0 ? `Valid until ${new Date(expiresSec * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Active caregiver pass";

  const body = `
    <div class="top"><span>🔒 Wee Hours · Caregiver Pass</span><b>${esc(sitterName)} · ${esc(expText)}</b></div>
    ${url.searchParams.get("logged") ? `<div class="toast">✓ Logged for ${esc(chosen.name)}</div>` : ""}
    ${children.length > 1 ? `<div class="tabs">${children.map((c) => `<a class="${c.id === chosen.id ? "on" : ""}" href="/pass/${token}?child=${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join("")}</div>` : ""}
    <h1>${esc(chosen.name)}</h1>
    <div class="card status"><p class="line">${esc(line)}</p><small>Parents see everything you log here automatically.</small></div>
    ${pinnedNote ? `<div class="card note"><b>Pinned by parents</b><p>${esc(pinnedNote)}</p></div>` : ""}
    <form method="POST" action="/pass/${token}/log" class="grid">
      <input type="hidden" name="baby" value="${esc(chosen.id)}"/>
      ${s.open_feed_kind === "bottle"
        ? `<button name="type" value="feed.bottle.finish" class="tile feed"><b>Finish bottle</b><small>drank all</small></button>`
        : `<button name="type" value="feed.bottle.start" class="tile feed"><b>Start bottle</b><small>tap when starting</small></button>`}
      <button name="type" value="diaper" onclick="this.form.kind.value='wet'" class="tile diaper"><b>Wet diaper</b><small>pee</small></button>
      <button name="type" value="diaper" onclick="this.form.kind.value='dirty'" class="tile diaper"><b>Dirty diaper</b><small>poop</small></button>
      <input type="hidden" name="kind" value="wet"/>
      ${s.sleeping_since
        ? `<button name="type" value="sleep.end" class="tile sleep"><b>Woke up</b><small>end nap / sleep</small></button>`
        : `<button name="type" value="sleep.start" class="tile sleep"><b>Fell asleep</b><small>start nap / sleep</small></button>`}
    </form>
    <form method="POST" action="/pass/${token}/log" class="card note-form">
      <input type="hidden" name="baby" value="${esc(chosen.id)}"/>
      <input type="hidden" name="type" value="note"/>
      <input type="text" name="note" placeholder="Leave a note for the parents…" required/>
      <button type="submit">Send note</button>
    </form>`;
  return new Response(passHtml(`${chosen.name} · Wee Hours Pass`, body), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function passHtml(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#111216;color:#f5f5f7;margin:0;padding:16px;max-width:460px;margin-inline:auto}
    .top{display:flex;justify-content:space-between;font-size:12px;color:#9ea3b0;background:#1c1d24;padding:8px 12px;border-radius:10px;margin-bottom:14px}
    .top b{color:#f29e66}.toast{background:#1b3b2b;color:#6ee7b7;padding:10px 14px;border-radius:12px;margin-bottom:12px;font-weight:600;font-size:14px}
    .tabs{display:flex;gap:8px;margin-bottom:10px}.tabs a{padding:6px 14px;border-radius:99px;background:#1c1d24;color:#f5f5f7;text-decoration:none;font-weight:600;font-size:14px}
    .tabs a.on{background:#f29e66;color:#111}h1{margin:4px 0 12px;font-size:28px}
    .card{background:#1c1d24;padding:14px 16px;border-radius:16px;margin-bottom:12px}.line{font-size:18px;font-weight:600;margin:0 0 6px}
    .card small{color:#9ea3b0;font-size:12px}.note{border-left:3px solid #f29e66}.note b{font-size:12px;text-transform:uppercase;color:#f29e66}
    .note p{margin:6px 0 0;font-size:14px;line-height:1.4}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    .tile{border:0;border-radius:16px;padding:16px;text-align:left;color:#f5f5f7;cursor:pointer;display:flex;flex-direction:column;gap:4px}
    .tile b{font-size:16px}.tile small{font-size:12px;opacity:.75}
    .tile.feed{background:rgba(250,179,115,.18)}.tile.diaper{background:rgba(115,191,242,.18)}.tile.sleep{background:rgba(158,148,242,.18)}
    .note-form{display:flex;gap:8px}.note-form input{flex:1;background:#111216;border:1px solid #2e303d;color:#fff;border-radius:10px;padding:10px;font-size:14px}
    .note-form button{background:#f29e66;color:#111;border:0;border-radius:10px;padding:0 14px;font-weight:600;cursor:pointer}
  </style></head><body>${body}</body></html>`;
}

const app = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/authorize") return authorize(req, env);
    if (url.pathname === "/api/grants" || url.pathname.startsWith("/api/grants/")) return grants(req, env, url);
    if (url.pathname.startsWith("/pass/")) return caregiverPass(req, env, url);
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
