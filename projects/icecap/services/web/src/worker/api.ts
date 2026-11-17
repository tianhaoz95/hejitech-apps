// Icecap's API (/api/*). Clients send the user's Supabase access token as a Bearer token; the
// extension calls it cross-origin (chrome-extension://…), so every answer carries CORS headers. No
// cookies are used, so a wildcard origin is safe.
//
//   GET    /api/pro                 Pro status + plans on sale (signed in)
//   POST   /api/billing/checkout    { plan } → Stripe Checkout URL (signed in)
//   POST   /api/billing/portal      Stripe billing portal URL (signed in)
//   GET    /api/waitlist            { count }
//   POST   /api/waitlist            { email, name?, source? } → joins the early-access list
//   DELETE /api/account             deletes the user's Icecap data (signed in)
//   GET    /api/admin/stats | /api/admin/waitlist | /api/admin/pro          (admins)
//   POST   /api/admin/grants { email, until?, note? }; DELETE { email }     (admins)
import type { AdminProAccount, AdminStats, WaitlistEntry } from "@icecap/types";
import { checkout, offers, portal, proStatus, purchaseActive, StripeError, type PurchaseRow } from "./billing.ts";
import { deleteUserData, isAdmin, json, supabaseUser, validEmail, type Db, type Env } from "./store.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const reply = (body: unknown, status = 200) => json(body, status, CORS);

async function waitlistCount(db: Db): Promise<number> {
  const { count, error } = await db.from("waitlist").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function emailOf(db: Db, userId: string): Promise<string | null> {
  const r = await db.auth.admin.getUserById(userId).catch(() => null);
  return r?.data?.user?.email ?? null;
}

export async function handleApi(req: Request, env: Env, db: Db): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // ------------------------------------------------------------ public
  if (path === "/api/waitlist" && req.method === "GET") return reply({ count: await waitlistCount(db) });
  if (path === "/api/waitlist" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; name?: unknown; source?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!validEmail(email)) return reply({ error: "invalid_email", message: "Please enter a valid email address." }, 400);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) || null : null;
    const source = typeof body.source === "string" ? body.source.slice(0, 100) : null;
    const { error } = await db.from("waitlist").insert({ email, name, source });
    if (error && error.code !== "23505") throw new Error(error.message);
    return reply({ ok: true, already: error?.code === "23505", count: await waitlistCount(db) });
  }

  // ------------------------------------------------------------ signed in
  const user = await supabaseUser(env, req);
  if (!user) return reply({ error: "unauthorized", message: "Sign in first." }, 401);

  if (path === "/api/pro" && req.method === "GET") {
    const status = await proStatus(db, user.id, user.email);
    return reply({ ...status, email: user.email ?? null, offers: await offers(env).catch(() => []) });
  }
  if ((path === "/api/billing/checkout" || path === "/api/billing/portal") && req.method === "POST") {
    try {
      const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
      const who = { userId: user.id, email: user.email };
      return reply({ url: path.endsWith("checkout") ? await checkout(env, db, who, body.plan) : await portal(env, db, who) });
    } catch (e) {
      if (e instanceof StripeError) return reply({ error: "billing", message: e.message }, e.status);
      throw e;
    }
  }
  if (path === "/api/account" && req.method === "DELETE") {
    await deleteUserData(db, user.id);
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ admins
  if (path.startsWith("/api/admin/")) {
    if (!(await isAdmin(db, user.id))) return reply({ error: "forbidden", message: "Admins only." }, 403);

    if (path === "/api/admin/stats" && req.method === "GET") {
      const [props, purchases, grants, waitlist] = await Promise.all([
        db.from("properties").select("user_id"),
        db.from("purchases").select("tier, expires_at, revoked_at, user_id"),
        db.from("pro_grants").select("until"),
        waitlistCount(db),
      ]);
      const now = Date.now();
      const stats: AdminStats = {
        accounts: new Set((props.data ?? []).map((r) => r.user_id)).size,
        properties: props.data?.length ?? 0,
        waitlist,
        pro: {
          stripe: new Set(((purchases.data ?? []) as PurchaseRow[]).filter((r) => purchaseActive(r, now)).map((r) => r.user_id)).size,
          grants: (grants.data ?? []).filter((g) => !g.until || Date.parse(g.until) > now).length,
        },
      };
      return reply(stats);
    }
    if (path === "/api/admin/waitlist" && req.method === "GET") {
      const { data, error } = await db.from("waitlist").select("id, email, name, source, created_at").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return reply({ entries: data as WaitlistEntry[] });
    }
    if (path === "/api/admin/pro" && req.method === "GET") {
      const [{ data: purchases }, { data: grants }] = await Promise.all([
        db.from("purchases").select("*").order("updated_at", { ascending: false }),
        db.from("pro_grants").select("*").order("granted_at", { ascending: false }),
      ]);
      const paid = await Promise.all(
        ((purchases ?? []) as PurchaseRow[]).filter((r) => purchaseActive(r)).map(async (r): Promise<AdminProAccount> => ({
          email: await emailOf(db, r.user_id),
          user_id: r.user_id,
          source: "stripe",
          plan: r.tier,
          until: r.tier === "lifetime" ? null : r.expires_at,
          environment: r.environment,
          note: null,
        })),
      );
      const given = (grants ?? []).map((g): AdminProAccount => ({ email: g.email, user_id: null, source: "grant", plan: g.until ? "annual" : "lifetime", until: g.until, environment: null, note: g.note }));
      return reply({ accounts: [...paid, ...given] });
    }
    if (path === "/api/admin/grants" && (req.method === "POST" || req.method === "DELETE")) {
      const body = (await req.json().catch(() => ({}))) as { email?: unknown; until?: unknown; note?: unknown };
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!validEmail(email)) return reply({ error: "invalid_email", message: "A valid email is required." }, 400);
      if (req.method === "DELETE") {
        const { error } = await db.from("pro_grants").delete().eq("email", email);
        if (error) throw new Error(error.message);
        return reply({ ok: true });
      }
      const until = typeof body.until === "string" && body.until ? new Date(`${body.until.slice(0, 10)}T23:59:59Z`).toISOString() : null;
      const note = typeof body.note === "string" ? body.note.slice(0, 200) || null : null;
      const { error } = await db.from("pro_grants").upsert({ email, until, note, granted_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      return reply({ ok: true });
    }
  }

  return reply({ error: "not_found" }, 404);
}
