import type { Db } from "./db.js";
import { eq } from "./db.js";

export type Tier = "free" | "annual" | "lifetime";

export interface Plan { tier: Tier; activeTrips: number; offlineMaps: boolean; maxAreas: number }

export const PLANS: Record<Tier, Plan> = {
  free: { tier: "free", activeTrips: 1, offlineMaps: false, maxAreas: 0 },
  annual: { tier: "annual", activeTrips: 10, offlineMaps: true, maxAreas: 4 },
  lifetime: { tier: "lifetime", activeTrips: 10, offlineMaps: true, maxAreas: 4 },
};

export const upgradeHint = (publicUrl: string) =>
  `Upgrade to Waypack Pro at ${publicUrl}/account#billing to unlock offline maps and up to 10 active trips.`;

interface EntRow { tier: Tier; active: boolean; expires_at: string | null; source: string | null }
interface AppStoreRow { tier: Tier; expires_at: string | null; revoked_at: string | null; product_id: string; environment: string }

export type PlanSource = "stripe" | "app_store" | "manual";

export interface PlanDetails {
  plan: Plan;
  /** Where the plan comes from; null on the free plan. */
  source: PlanSource | null;
  expires_at: string | null;
  /** The App Store product behind the plan, when source is app_store. */
  app_store_product?: string;
}

const RANK: Record<Tier, number> = { free: 0, annual: 1, lifetime: 2 };

/**
 * The user's plan: the better of the Stripe/manual row in `entitlements` and any active App Store
 * purchase (`app_store_purchases`, DECISIONS #72). Lifetime beats annual; between two annual plans
 * the later expiry wins.
 */
export async function planDetails(db: Db, userId: string, now = new Date()): Promise<PlanDetails> {
  const [row, apple] = await Promise.all([
    db.one<EntRow>("entitlements", `select=tier,active,expires_at,source&user_id=${eq(userId)}`),
    // Until the app_store_purchases migration is in a database, treat it as having no App Store purchases.
    db.select<AppStoreRow>("app_store_purchases", `select=tier,expires_at,revoked_at,product_id,environment&user_id=${eq(userId)}&revoked_at=is.null`).catch(() => [] as AppStoreRow[]),
  ]);
  const candidates: PlanDetails[] = [];
  if (row?.active && row.tier !== "free" && (row.tier === "lifetime" || !row.expires_at || new Date(row.expires_at) >= now)) {
    candidates.push({ plan: PLANS[row.tier] ?? PLANS.free, source: row.source === "manual" ? "manual" : "stripe", expires_at: row.tier === "lifetime" ? null : row.expires_at });
  }
  for (const a of apple) {
    const live = a.tier === "lifetime" || (!!a.expires_at && new Date(a.expires_at) > now);
    if (live && PLANS[a.tier]) candidates.push({ plan: PLANS[a.tier], source: "app_store", expires_at: a.tier === "lifetime" ? null : a.expires_at, app_store_product: a.product_id });
  }
  const best = candidates.sort((x, y) => RANK[y.plan.tier] - RANK[x.plan.tier] || Date.parse(y.expires_at ?? "") - Date.parse(x.expires_at ?? ""))[0];
  return best ?? { plan: PLANS.free, source: null, expires_at: null };
}

export async function planFor(db: Db, userId: string, now = new Date()): Promise<Plan> {
  return (await planDetails(db, userId, now)).plan;
}

export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);

/** Trips whose end date hasn't passed (or have no dates yet) count as active. */
export async function activeTripCount(db: Db, userId: string, excludeTripId?: string, now = new Date()): Promise<number> {
  const rows = await db.select<{ id: string; end_date: string | null }>(
    "trips",
    `select=id,end_date&user_id=${eq(userId)}&deleted_at=is.null&or=(end_date.is.null,end_date.gte.${todayUtc(now)})`,
  );
  return rows.filter((r) => r.id !== excludeTripId).length;
}
