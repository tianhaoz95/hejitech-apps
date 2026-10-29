// Sign-in for App Review only. Headway offers no email sign-in to people (Sign in with Apple and
// Google only, and the shared Supabase project has its Email provider off), but App Review needs
// a demo account. POST /api/review-sign-in { email, password } checks them against this Worker's
// own secrets (REVIEW_EMAIL, REVIEW_PASSWORD_SHA256), resets that one account to the demo state
// and mints it a normal Supabase session (admin magic link → verify; nothing is emailed). Without
// the secrets the endpoint doesn't exist. Set up and rotate: scripts/review_account.sh (repo root).
import { sha256 } from "./store.ts";

export interface ReviewEnv {
  /** Throttles wrong passwords per IP when the Worker has a KV namespace (any binding named so). */
  OAUTH_KV?: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** The App Review demo account's email (Worker secret). */
  REVIEW_EMAIL?: string;
  /** SHA-256 (hex) of its password (Worker secret; the password itself is only in App Store Connect). */
  REVIEW_PASSWORD_SHA256?: string;
}

const FAILURES_PER_WINDOW = 10;
const WINDOW_SEC = 600;

export type ReviewResult = { status: number; body: unknown };

/**
 * Checks the demo credentials, runs `reset(userId)` (the project's demo state) and returns a
 * Supabase session: `{ access_token, refresh_token, expires_in, user, … }`, as `/auth/v1/token` does.
 */
export async function reviewSignIn(env: ReviewEnv, req: Request, reset: (userId: string) => Promise<void>): Promise<ReviewResult> {
  if (!env.REVIEW_EMAIL || !env.REVIEW_PASSWORD_SHA256) return { status: 404, body: { error: "not found" } };
  const ip = req.headers.get("CF-Connecting-IP") ?? "local";
  const key = `reviewfail:${ip}`;
  const failures = Number((await env.OAUTH_KV?.get(key)) ?? 0);
  if (failures >= FAILURES_PER_WINDOW) return { status: 429, body: { error: "too many attempts: wait ten minutes" } };

  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  const given = new TextEncoder().encode(await sha256(String(body.password ?? "")));
  const want = new TextEncoder().encode(env.REVIEW_PASSWORD_SHA256.toLowerCase());
  const ok = email === env.REVIEW_EMAIL.toLowerCase() && given.byteLength === want.byteLength && crypto.subtle.timingSafeEqual(given, want);
  if (!ok) {
    await env.OAUTH_KV?.put(key, String(failures + 1), { expirationTtl: WINDOW_SEC });
    return { status: 401, body: { error: "wrong email or password" } };
  }

  const admin = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const auth = (path: string, init: RequestInit) => fetch(`${env.SUPABASE_URL}/auth/v1/${path}`, init);
  const link = () => auth("admin/generate_link", { method: "POST", headers: admin, body: JSON.stringify({ type: "magiclink", email }) });

  // The account is created on first use: no setup in Supabase, and deleting it is harmless.
  let res = await link();
  if (!res.ok) {
    const created = await auth("admin/users", { method: "POST", headers: admin, body: JSON.stringify({ email, email_confirm: true }) });
    if (!created.ok) return { status: 502, body: { error: `couldn't create the review account: ${await created.text()}` } };
    res = await link();
  }
  if (!res.ok) return { status: 502, body: { error: `couldn't sign in the review account: ${await res.text()}` } };
  const generated = (await res.json()) as {
    id?: string; hashed_token?: string; verification_type?: string;
    properties?: { hashed_token?: string; verification_type?: string };
  };
  const tokenHash = generated.hashed_token ?? generated.properties?.hashed_token;
  // A user made by this link gets a "signup" token, an existing one "magiclink".
  const type = generated.verification_type ?? generated.properties?.verification_type ?? "magiclink";
  if (!generated.id || !tokenHash) return { status: 502, body: { error: "unexpected generate_link response" } };

  await reset(generated.id);

  const session = await auth("verify", {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type, token_hash: tokenHash }),
  });
  if (!session.ok) return { status: 502, body: { error: `couldn't sign in the review account: ${await session.text()}` } };
  return { status: 200, body: await session.json() };
}
