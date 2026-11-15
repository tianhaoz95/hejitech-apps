// The App Store purchase routes and their supabase-js store (logic and checks: appstore.ts).
import { AppStoreError, handleNotification, purchaseActive, recordTransactions, type PurchaseRow, type Store } from "./appstore.ts";
import type { Db } from "./mcp.ts";

export function purchaseStore(db: Db): Store {
  return {
    async householdOf(userId) {
      const { data } = await db.from("members").select("household_id").eq("user_id", userId).limit(1).maybeSingle();
      return (data?.household_id as string | undefined) ?? null;
    },
    async purchase(otid) {
      const { data } = await db.from("app_store_purchases").select("*").eq("original_transaction_id", otid).maybeSingle();
      return (data as PurchaseRow | null) ?? null;
    },
    async savePurchase(row) {
      const { error } = await db.from("app_store_purchases").upsert(row, { onConflict: "original_transaction_id" });
      if (error) throw new Error(`save purchase: ${error.message}`);
    },
    async householdPurchases(householdId) {
      const { data } = await db.from("app_store_purchases").select("*").eq("household_id", householdId);
      return (data as PurchaseRow[] | null) ?? [];
    },
    async setEntitlement(householdId, e) {
      // Keeps trial_started_at; a household row exists for every household (created with it).
      const { error } = await db.from("entitlements").update({ plan: e.plan, expires_at: e.expires_at, source: "app_store", updated_at: new Date().toISOString() }).eq("household_id", householdId);
      if (error) throw new Error(`set entitlement: ${error.message}`);
    },
    async recordNotification(uuid, type) {
      const { error } = await db.from("app_store_notifications").insert({ id: uuid, type });
      return !error; // a duplicate id fails the insert
    },
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function handlePurchases(req: Request, url: URL, db: Db, sessionUser: (r: Request) => Promise<{ id: string } | null>): Promise<Response | null> {
  if (url.pathname === "/api/appstore/transactions" && req.method === "POST") {
    const user = await sessionUser(req);
    if (!user) return json({ error: "Sign in to restore purchases to your household." }, 401);
    const body = (await req.json().catch(() => ({}))) as { transactions?: unknown };
    try {
      const r = await recordTransactions(purchaseStore(db), user.id, body.transactions);
      return json({ entitlement: r.entitlement, saved: r.saved.map((p) => ({ product_id: p.product_id, active: purchaseActive(p), expires_at: p.expires_at })), rejected: r.rejected }, r.saved.length || !r.rejected.length ? 200 : 400);
    } catch (e) {
      if (e instanceof AppStoreError) return json({ error: e.message }, 409);
      throw e;
    }
  }
  if (url.pathname === "/appstore/notifications" && req.method === "POST") {
    const r = await handleNotification(purchaseStore(db), await req.json().catch(() => null));
    console.log("appstore notification", r.result);
    return json({ ok: r.status < 300, result: r.result }, r.status);
  }
  return null;
}
