// The Worker's "now". In production it is the real clock. On the local stack (PUBLIC_URL on 127.0.0.1 or
// localhost) it can be moved to any moment with PUT /api/dev/clock { at: ISO | null }, so boards, alerts,
// tracking and the ETA page can be tested and recorded against any Caltrain schedule (a weekday rush, a
// weekend, a late night) without waiting for it. The local iPhone app (Debug) and the glasses plugin read the
// same offset from GET /api/dev/clock at launch. The offset lives in this isolate only (wrangler dev runs one);
// it resets when the Worker restarts. Database timestamps (created_at, expiry) stay on the real clock.
import type { Env } from "./store.ts";

let offsetMs = 0;

/** True when this Worker serves the local stack, where the demo clock is allowed. */
export const isLocal = (env: Pick<Env, "PUBLIC_URL">): boolean => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(env.PUBLIC_URL ?? "");

/** Now (epoch ms), with the demo offset on the local stack. */
export function now(env: Pick<Env, "PUBLIC_URL">): number {
  return isLocal(env) ? Date.now() + offsetMs : Date.now();
}

/** GET/PUT /api/dev/clock (local stack only): { now, offset_ms, real }. PUT { at: ISO } moves the clock, { at: null } resets it. */
export async function devClock(req: Request, env: Pick<Env, "PUBLIC_URL">): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  if (!isLocal(env)) return json({ error: "not found" }, 404);
  if (req.method === "PUT" || req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { at?: string | number | null; offset_ms?: number };
    if (body.at === null) offsetMs = 0;
    else if (typeof body.offset_ms === "number") offsetMs = body.offset_ms;
    else {
      const at = typeof body.at === "number" ? body.at : Date.parse(String(body.at));
      if (!Number.isFinite(at)) return json({ error: "at: an ISO time (with its offset, e.g. 2026-11-09T07:40:00-08:00), epoch ms, or null" }, 400);
      offsetMs = at - Date.now();
    }
  }
  const real = Date.now();
  return json({ now: real + offsetMs, offset_ms: offsetMs, real });
}
