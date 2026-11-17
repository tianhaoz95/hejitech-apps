// Robinhood sign-in handoff for the iPhone app (decisions.md "Robinhood on the iPhone"). Robinhood's
// sign-in refuses phones ("Use your desktop web browser"), so the phone starts the OAuth flow, the
// owner signs in on a computer, and Robinhood redirects that computer's browser here. This file only
// relays the one-time authorization code back to the phone that started it:
//
//   POST /api/robinhood/handoff        (owner session) the phone registers {state, authorize_url} →
//                                      a short link for the computer
//   GET  /rh/<short>                   (public) 302 to Robinhood's sign-in page
//   GET  /oauth/robinhood/callback     (public) Robinhood's redirect: keeps the code for that state
//   GET  /api/robinhood/handoff/<state> (owner session, same user) the phone collects the code, once
//
// The board still never holds a Robinhood credential (§5.2.4): the code is useless without the PKCE
// verifier, which never leaves the phone, and it lives in KV for at most 10 minutes, deleted when
// collected. Nothing here calls Robinhood.
import { json, problem, rateLimit, type Env } from "./store.ts";

export const HANDOFF_TTL_SEC = 600;
export const CALLBACK_PATH = "/oauth/robinhood/callback";
export const STATE_RE = /^[A-Za-z0-9_-]{32,128}$/;
export const SHORT_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

interface Entry {
  user_id: string;
  authorize_url: string;
  short: string;
  expires_at: string;
  code?: string;
  iss?: string;
  error?: string;
}

const stateKey = (s: string) => `rhh:${s}`;
const shortKey = (s: string) => `rhl:${s}`;

/** Only Robinhood's own sign-in page, for this state, returning to this Worker's callback. */
export function checkAuthorizeUrl(raw: string, state: string, publicUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "authorize_url isn't a URL";
  }
  if (u.protocol !== "https:" || !(u.hostname === "robinhood.com" || u.hostname.endsWith(".robinhood.com"))) return "authorize_url must be Robinhood's sign-in page";
  if (u.searchParams.get("state") !== state) return "authorize_url's state doesn't match";
  if (u.searchParams.get("redirect_uri") !== `${publicUrl}${CALLBACK_PATH}`) return `authorize_url must return to ${publicUrl}${CALLBACK_PATH}`;
  if (u.searchParams.get("code_challenge_method") !== "S256" || !u.searchParams.get("code_challenge")) return "authorize_url must use PKCE (S256)";
  return null;
}

/** Eight characters a person can read off a phone and type (no 0/O, 1/I). */
export function shortCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = rand(8);
  const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** The owner API half (inside portal.ts, after the session check). */
export async function handleHandoffApi(req: Request, env: Env, url: URL, userId: string, body: Record<string, unknown>, audit: (action: string, details: Record<string, unknown>) => PromiseLike<unknown>): Promise<Response | null> {
  const kv = env.OAUTH_KV;
  if (url.pathname === "/api/robinhood/handoff" && req.method === "POST") {
    const state = String(body.state ?? "");
    if (!STATE_RE.test(state)) return problem(422, "bad_state", "state must be 32–128 URL-safe characters");
    const why = checkAuthorizeUrl(String(body.authorize_url ?? ""), state, env.PUBLIC_URL);
    if (why) return problem(422, "bad_authorize_url", why);
    if (await kv.get(stateKey(state))) return problem(409, "state_in_use", "start a new sign-in");
    // Its own key prefix: a user id has the shape of a state.
    if (!(await rateLimit(kv, `rhrate:${userId}`, 10, 60))) return problem(429, "rate_limited", "too many sign-in attempts; wait a minute");
    const short = shortCode();
    const entry: Entry = { user_id: userId, authorize_url: String(body.authorize_url), short, expires_at: new Date(Date.now() + HANDOFF_TTL_SEC * 1000).toISOString() };
    await kv.put(stateKey(state), JSON.stringify(entry), { expirationTtl: HANDOFF_TTL_SEC });
    await kv.put(shortKey(short), state, { expirationTtl: HANDOFF_TTL_SEC });
    await audit("robinhood.handoff_started", { short });
    return json({ short, link: `${env.PUBLIC_URL}/rh/${short}`, expires_at: entry.expires_at }, 201);
  }
  const m = url.pathname.match(/^\/api\/robinhood\/handoff\/([A-Za-z0-9_-]{32,128})$/);
  if (m && req.method === "GET") {
    const raw = await kv.get(stateKey(m[1]));
    const e = raw ? (JSON.parse(raw) as Entry) : null;
    if (!e || e.user_id !== userId) return problem(404, "not_found", "this sign-in expired or was already collected: start again");
    if (!e.code && !e.error) return json({ status: "pending", expires_at: e.expires_at });
    await kv.delete(stateKey(m[1]));
    await kv.delete(shortKey(e.short));
    await audit("robinhood.handoff_collected", { short: e.short, ok: !!e.code });
    return e.code ? json({ status: "done", code: e.code, iss: e.iss ?? null }) : json({ status: "error", error: e.error });
  }
  return null;
}

/** The public half: the short link and Robinhood's redirect, opened in the computer's browser. */
export async function handleHandoffPublic(req: Request, env: Env, url: URL): Promise<Response | null> {
  const kv = env.OAUTH_KV;
  const sm = url.pathname.match(/^\/rh\/([A-Za-z0-9-]{9})\/?$/);
  if (sm && req.method === "GET") {
    const short = sm[1].toUpperCase();
    const state = SHORT_RE.test(short) ? await kv.get(shortKey(short)) : null;
    const raw = state ? await kv.get(stateKey(state)) : null;
    if (!raw) return page(404, "This link expired", "Start the Robinhood sign-in again in Tradeboard on your iPhone. Links last 10 minutes.");
    const e = JSON.parse(raw) as Entry;
    if (e.code || e.error) return page(410, "Already used", "This sign-in already finished. Go back to Tradeboard on your iPhone.");
    return new Response(null, { status: 302, headers: { Location: e.authorize_url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  if (url.pathname === CALLBACK_PATH && req.method === "GET") {
    const state = url.searchParams.get("state") ?? "";
    const raw = STATE_RE.test(state) ? await kv.get(stateKey(state)) : null;
    if (!raw) return page(404, "This sign-in expired", "Start the Robinhood sign-in again in Tradeboard on your iPhone.");
    const e = JSON.parse(raw) as Entry;
    if (e.code || e.error) return page(410, "Already used", "This sign-in already finished. Go back to Tradeboard on your iPhone.");
    const code = url.searchParams.get("code");
    const err = url.searchParams.get("error");
    if (code && code.length <= 2048) {
      e.code = code;
      e.iss = url.searchParams.get("iss") ?? undefined;
    } else {
      e.error = (err ? `${err}${url.searchParams.get("error_description") ? `: ${url.searchParams.get("error_description")}` : ""}` : "Robinhood sent no code").slice(0, 300);
    }
    const left = Math.max(60, Math.floor((Date.parse(e.expires_at) - Date.now()) / 1000));
    await kv.put(stateKey(state), JSON.stringify(e), { expirationTtl: left });
    return e.code
      ? page(200, "Robinhood connected", "Go back to Tradeboard on your iPhone: it finishes the sign-in by itself. You can close this tab.")
      : page(200, "Robinhood sign-in didn't finish", `${e.error}. Go back to Tradeboard on your iPhone to try again.`);
  }
  return null;
}

function page(status: number, title: string, text: string): Response {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · Tradeboard</title><style>body{font:17px/1.5 -apple-system,system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 24px;color:#111;background:#fff}@media (prefers-color-scheme:dark){body{color:#eee;background:#111}}h1{font-size:26px}</style><h1>${esc(title)}</h1><p>${esc(text)}</p></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff" } });
}
