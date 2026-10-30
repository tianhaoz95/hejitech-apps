// The owner's portal session (§8.3). Sign-in is two steps: a Google or Apple sign-in through the
// shared Supabase project proves the account (only OWNER_EMAIL, then only that user id), and a TOTP
// code proves the second factor. The Worker then sets its own HttpOnly, SameSite=Strict cookie; the
// browser drops the Supabase session. Agent tokens, executor credentials and this cookie are three
// separate kinds: none works where another is expected.
import { newTotpSecret, otpauthUri, verifyTotp } from "@tradeboard/core";
import { admin, json, problem, rateLimit, randomToken, seal, sha256, unseal, type Db, type Env } from "./store.ts";

const LOGIN_FAILS_PER_IP = 8;
const LOGIN_FAILS_GLOBAL = 30;
const LOGIN_WINDOW_SEC = 900;

export const cookieName = (env: Env) => (env.PUBLIC_URL.startsWith("https://") ? "__Host-tb_session" : "tb_session");

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

function sessionCookie(env: Env, value: string, maxAgeSec: number): string {
  const secure = env.PUBLIC_URL.startsWith("https://") ? "; Secure" : "";
  return `${cookieName(env)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}

/** The owner's session from the cookie, or null. Bearer headers are never looked at here. */
export async function ownerSession(env: Env, db: Db, req: Request): Promise<{ tokenHash: string } | null> {
  const value = readCookie(req, cookieName(env));
  if (!value) return null;
  const tokenHash = await sha256(value);
  const { data } = await db.from("sessions").select("token_hash, expires_at, revoked_at, last_seen_at").eq("token_hash", tokenHash).maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at as string) <= new Date()) return null;
  if (Date.now() - new Date(data.last_seen_at as string).getTime() > 60_000) {
    await db.from("sessions").update({ last_seen_at: new Date().toISOString() }).eq("token_hash", tokenHash);
  }
  return { tokenHash };
}

/**
 * Cross-site request forgery: state-changing portal calls must come from this origin's pages
 * (custom header + Origin), on top of the SameSite=Strict cookie.
 */
export function sameOrigin(env: Env, req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  if (req.headers.get("X-Tradeboard") !== "1") return false;
  const origin = req.headers.get("Origin");
  return !origin || origin === new URL(env.PUBLIC_URL).origin;
}

async function supabaseUser(env: Env, accessToken: string): Promise<{ id: string; email: string } | null> {
  if (!accessToken || accessToken.startsWith("tb")) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email?: string };
  return u.email ? { id: u.id, email: u.email } : null;
}

interface OwnerRow {
  user_id: string;
  email: string;
  totp_secret_enc: string | null;
  totp_pending_enc: string | null;
  totp_enrolled_at: string | null;
  totp_last_step: number | null;
}

const clientIp = (req: Request) => req.headers.get("CF-Connecting-IP") ?? "local";

async function loginFailed(env: Env, db: Db, req: Request, why: string) {
  await rateLimit(env.OAUTH_KV, `loginfail:${clientIp(req)}`, 1e9, LOGIN_WINDOW_SEC);
  await rateLimit(env.OAUTH_KV, "loginfail:all", 1e9, LOGIN_WINDOW_SEC);
  await db.rpc("audit", { p_actor_type: "system", p_actor_id: "portal", p_action: "auth.failed", p_plan_id: null, p_details: { why, ip_hash: (await sha256(clientIp(req))).slice(0, 12) } });
}

async function throttled(env: Env, req: Request): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / LOGIN_WINDOW_SEC);
  const ip = Number((await env.OAUTH_KV.get(`rl:loginfail:${clientIp(req)}:${window}`)) ?? 0);
  const all = Number((await env.OAUTH_KV.get(`rl:loginfail:all:${window}`)) ?? 0);
  return ip >= LOGIN_FAILS_PER_IP || all >= LOGIN_FAILS_GLOBAL;
}

/** Checks the Supabase account is the owner's. The first matching sign-in claims the owner row. */
async function ownerFor(env: Env, db: Db, user: { id: string; email: string }): Promise<OwnerRow | null> {
  const { data } = await db.from("owner").select("*").eq("id", true).maybeSingle();
  if (data) return (data as OwnerRow).user_id === user.id ? (data as OwnerRow) : null;
  if (!env.OWNER_EMAIL || user.email.toLowerCase() !== env.OWNER_EMAIL.trim().toLowerCase()) return null;
  const { data: created } = await db.from("owner").insert({ id: true, user_id: user.id, email: user.email }).select("*").single();
  await db.rpc("audit", { p_actor_type: "human", p_actor_id: "owner", p_action: "owner.claimed", p_plan_id: null, p_details: {} });
  return (created as OwnerRow | null) ?? null;
}

/**
 * POST /api/auth/begin {access_token}: is this the owner, and do they still need to enroll TOTP?
 * Enrollment returns the secret once (as text and an otpauth:// URI for the authenticator app).
 */
export async function authBegin(req: Request, env: Env): Promise<Response> {
  const db = admin(env);
  if (await throttled(env, req)) return problem(429, "rate_limited", "Too many failed sign-ins. Wait 15 minutes.");
  const body = (await req.json().catch(() => ({}))) as { access_token?: string };
  const user = await supabaseUser(env, String(body.access_token ?? ""));
  if (!user) return problem(401, "signin_required", "Sign in with Google or Apple first.");
  const owner = await ownerFor(env, db, user);
  if (!owner) {
    await loginFailed(env, db, req, "not the owner");
    return problem(403, "not_owner", "This board belongs to another account.");
  }
  if (owner.totp_enrolled_at) return json({ enroll: false });
  const secret = newTotpSecret();
  await db.from("owner").update({ totp_pending_enc: await seal(env, secret) }).eq("id", true);
  return json({ enroll: true, secret, otpauth: otpauthUri(secret, user.email) });
}

/** POST /api/auth/verify {access_token, code}: the second factor; sets the session cookie. */
export async function authVerify(req: Request, env: Env): Promise<Response> {
  const db = admin(env);
  if (await throttled(env, req)) return problem(429, "rate_limited", "Too many failed sign-ins. Wait 15 minutes.");
  const body = (await req.json().catch(() => ({}))) as { access_token?: string; code?: string };
  const user = await supabaseUser(env, String(body.access_token ?? ""));
  if (!user) return problem(401, "signin_required", "Sign in with Google or Apple first.");
  const owner = await ownerFor(env, db, user);
  if (!owner) {
    await loginFailed(env, db, req, "not the owner");
    return problem(403, "not_owner", "This board belongs to another account.");
  }
  const enrolling = !owner.totp_enrolled_at;
  const sealed = enrolling ? owner.totp_pending_enc : owner.totp_secret_enc;
  if (!sealed) return problem(409, "enroll_first", "Start again: your authenticator setup expired.");
  const step = await verifyTotp(await unseal(env, sealed), String(body.code ?? "").replace(/\s/g, ""), Date.now(), owner.totp_last_step === null ? null : Number(owner.totp_last_step));
  if (step === null) {
    await loginFailed(env, db, req, "wrong code");
    return problem(401, "wrong_code", "That code didn't match. Use the current 6-digit code from your authenticator.");
  }
  // Single use: a step at or below the last accepted one is refused next time (no replay).
  const { data: claimed } = await db.from("owner").update({
    totp_last_step: step,
    ...(enrolling ? { totp_secret_enc: owner.totp_pending_enc, totp_pending_enc: null, totp_enrolled_at: new Date().toISOString() } : {}),
  }).eq("id", true).or(`totp_last_step.is.null,totp_last_step.lt.${step}`).select("user_id");
  if (!claimed?.length) return problem(401, "wrong_code", "That code was already used. Wait for the next one.");
  const days = Number(env.SESSION_DAYS ?? 7) || 7;
  const token = randomToken();
  await db.from("sessions").insert({ token_hash: await sha256(token), expires_at: new Date(Date.now() + days * 86_400_000).toISOString(), user_agent: (req.headers.get("User-Agent") ?? "").slice(0, 200) });
  await db.rpc("audit", { p_actor_type: "human", p_actor_id: "owner", p_action: enrolling ? "auth.enrolled" : "auth.signed_in", p_plan_id: null, p_details: { session_days: days } });
  return json({ ok: true, enrolled: enrolling }, 200, { "Set-Cookie": sessionCookie(env, token, days * 86_400) });
}

export async function authLogout(req: Request, env: Env): Promise<Response> {
  const db = admin(env);
  const s = await ownerSession(env, db, req);
  if (s) await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", s.tokenHash);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(env, "", 0) });
}
