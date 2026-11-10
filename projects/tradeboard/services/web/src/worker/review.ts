// Sign-in for App Review only (skill heji-review-account). People sign in with Apple or Google plus a
// TOTP code, which a reviewer can't produce, so POST /api/review-sign-in {email, password} checks
// them against this Worker's own secrets (REVIEW_EMAIL, REVIEW_PASSWORD_SHA256), resets that one
// board to a demo state and sets the normal session cookie. Without the secrets the route doesn't
// exist. The demo board can never trade: every plan is a DEMO plan (the board hands those to an
// executor only in dry-run), dry-run is on, and it has no executor credential. Set up and rotate:
// scripts/review_account.sh tradeboard.
import { suggestedValidUntil } from "@tradeboard/core";
import { addComment, markReady, type Actor } from "./board.ts";
import { sessionCookieFor } from "./auth.ts";
import { audit, currentPolicy, ensureBoard, json, problem, randomToken, sha256, type Db, type Env } from "./store.ts";

const FAILURES_PER_WINDOW = 10;
const WINDOW_SEC = 600;

/** The App Review demo account (Worker secrets). */
export interface ReviewEnv {
  REVIEW_EMAIL?: string;
  /** SHA-256 (hex) of its password; the password itself is only in App Store Connect. */
  REVIEW_PASSWORD_SHA256?: string;
}

export async function reviewSignIn(req: Request, env: Env, db: Db): Promise<Response> {
  if (!env.REVIEW_EMAIL || !env.REVIEW_PASSWORD_SHA256) return problem(404, "not_found", "not found");
  const key = `reviewfail:${req.headers.get("CF-Connecting-IP") ?? "local"}`;
  const failures = Number((await env.OAUTH_KV.get(key)) ?? 0);
  if (failures >= FAILURES_PER_WINDOW) return problem(429, "rate_limited", "Too many attempts. Wait ten minutes.");

  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  const given = new TextEncoder().encode(await sha256(String(body.password ?? "")));
  const want = new TextEncoder().encode(env.REVIEW_PASSWORD_SHA256.toLowerCase());
  const ok = email === env.REVIEW_EMAIL.toLowerCase() && given.byteLength === want.byteLength && crypto.subtle.timingSafeEqual(given, want);
  if (!ok) {
    await env.OAUTH_KV.put(key, String(failures + 1), { expirationTtl: WINDOW_SEC });
    return problem(401, "wrong_password", "Wrong email or password.");
  }

  const userId = await reviewUserId(env, email);
  if (!userId) return problem(502, "upstream", "Couldn't sign in the review account. Try again.");
  await resetDemoBoard(db, userId, email);

  const days = Number(env.SESSION_DAYS ?? 7) || 7;
  const token = randomToken();
  await db.from("sessions").insert({ token_hash: await sha256(token), user_id: userId, expires_at: new Date(Date.now() + days * 86_400_000).toISOString(), user_agent: (req.headers.get("User-Agent") ?? "").slice(0, 200) });
  await audit(db, userId, "human", "owner", "auth.review_signed_in", null, { session_days: days });
  return json({ ok: true, signed_in: true, email }, 200, { "Set-Cookie": sessionCookieFor(env, token, days * 86_400) });
}

/** The demo account's user id, creating it in the shared user pool on first use (nothing is emailed). */
async function reviewUserId(env: Env, email: string): Promise<string | null> {
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const link = () => fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, { method: "POST", headers, body: JSON.stringify({ type: "magiclink", email }) });
  let res = await link();
  if (!res.ok) {
    const created = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, { method: "POST", headers, body: JSON.stringify({ email, email_confirm: true }) });
    if (!created.ok) return null;
    res = await link();
  }
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; user?: { id?: string } };
  return u.id ?? u.user?.id ?? null;
}

const CLAUDE: Omit<Actor, "userId"> = { type: "agent", id: "claude" };
const GEMINI: Omit<Actor, "userId"> = { type: "agent", id: "gemini" };

/**
 * Every review sign-in starts from the same board: the default policy, dry-run on, two agents, the
 * walkthrough DEMO plan, one DEMO plan agents have debated and marked ready for approval, and one
 * still under discussion with an open question. Dates are computed now, so plans are never stale.
 */
export async function resetDemoBoard(db: Db, userId: string, email: string): Promise<void> {
  await db.rpc("delete_account", { p_user_id: userId });
  await db.from("accounts").upsert({ user_id: userId, email, totp_enrolled_at: new Date().toISOString() }, { onConflict: "user_id" });
  await db.from("agents").insert([
    { user_id: userId, agent_id: "claude", display_name: "Claude" },
    { user_id: userId, agent_id: "gemini", display_name: "Gemini" },
  ]);
  await ensureBoard(db, userId); // policy v1, control (dry-run on) and the walkthrough DEMO plan
  const maxAge = (await currentPolicy(db, userId)).policy.max_plan_age_hours;
  const as = (a: Omit<Actor, "userId">): Actor => ({ ...a, userId });
  const now = new Date();
  const until = suggestedValidUntil(now) ?? new Date(now.getTime() + 24 * 3_600_000);
  const validUntil = (until > new Date(now.getTime() + 3_600_000) ? until : new Date(now.getTime() + 24 * 3_600_000)).toISOString();

  const plan = async (actor: Omit<Actor, "userId">, key: string, f: { title: string; ticker: string; shares: number; limit: number; thesis: string; evidence: string; risks: string; invalidation: string; fit: string }) => {
    const { data } = await db.rpc("create_plan", {
      p_user_id: userId, p_actor_type: actor.type, p_actor_id: actor.id, p_idempotency_key: key, p_is_demo: true,
      p_fields: {
        title: f.title, ticker: f.ticker,
        order: { ticker: f.ticker, side: "buy", order_type: "limit", quantity_shares: f.shares, quantity_dollars: null, limit_price: f.limit, stop_price: null, time_in_force: "day", account_scope: "dedicated_mcp_account_only" },
        thesis: f.thesis, evidence: f.evidence, risks_and_dissent: f.risks, invalidation: f.invalidation, fit_with_strategy: f.fit,
        valid_until: validUntil, valid_from: null, quote_price: null, quote_at: null, quote_source: null,
      },
    });
    return (data as { plan_id: string }).plan_id;
  };

  const ready = await plan(CLAUDE, "review-ready", {
    title: "DEMO — Add 5 MSFT on a pullback to support", ticker: "MSFT", shares: 5, limit: 405,
    thesis: "Cloud growth re-accelerated last quarter and the stock has pulled back to its 50-day average. A limit at support adds to the core position without chasing.",
    evidence: "Revenue and margin trends from the last two reports; the pullback came on lighter volume than the run-up.",
    risks: "Gemini: the whole sector is extended and a broad sell-off would take this through support. Sizing kept at 5 shares for that reason.",
    invalidation: "A daily close below the 100-day average, or guidance cut at the next report.",
    fit: "Fits the strategy's core-holdings sleeve: add on pullbacks, limit orders only, small size.",
  });
  await addComment(db, as(GEMINI), ready, { body: "Dissent: sector is extended. If we do this, keep it to 5 shares and a day order.", anchor: "risks_and_dissent" }, false);
  await addComment(db, as(CLAUDE), ready, { body: "Agreed: 5 shares, day order, limit at support. Marking ready for the owner." }, false);
  await markReady(db, as(CLAUDE), ready, maxAge);

  const debating = await plan(GEMINI, "review-debate", {
    title: "DEMO — Start a small COST position", ticker: "COST", shares: 2, limit: 880,
    thesis: "Steady membership growth and renewal rates; a starter position for the defensive sleeve.",
    evidence: "Membership and renewal figures from recent reports.",
    risks: "Valuation is rich for a retailer; a de-rating would hurt even with good results.",
    invalidation: "Renewal rate falling two quarters in a row.",
    fit: "Defensive sleeve: quality names, starter size.",
  });
  await addComment(db, as(CLAUDE), debating, { body: "@gemini the valuation point matters. What entry would you accept if it doesn't pull back?" }, true);
}
