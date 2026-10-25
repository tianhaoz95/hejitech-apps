// Fetches Caltrain's realtime feeds from 511.org and stores one snapshot for every board. 511 allows
// 60 requests an hour per token by default, so the cron fetches trip updates every
// REALTIME_EVERY_MIN minutes (default 2) and service alerts every 10, never per user request.
import { decodeFeed, type DecodedFeed, type RealtimeSnapshot } from "@headway/core";
import { loadSnapshot, storeSnapshot, type Db, type Env } from "./store.ts";

const BASE = "https://api.511.org/transit";
const ALERTS_EVERY_MIN = 10;

async function fetchFeed(kind: "tripupdates" | "servicealerts", key: string): Promise<DecodedFeed> {
  const res = await fetch(`${BASE}/${kind}?api_key=${encodeURIComponent(key)}&agency=CT`, { headers: { Accept: "application/x-protobuf" } });
  if (!res.ok) throw new Error(`511 ${kind}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  return decodeFeed(new Uint8Array(await res.arrayBuffer()));
}

/** Whether this cron minute should fetch (trip updates, alerts). */
export function due(now: Date, everyMin: number): { trips: boolean; alerts: boolean } {
  const m = now.getUTCHours() * 60 + now.getUTCMinutes();
  return { trips: m % Math.max(1, everyMin) === 0, alerts: m % ALERTS_EVERY_MIN === 0 };
}

/**
 * One cron tick: fetch what's due and store the merged snapshot. Returns it (or the previous one
 * when nothing was due). A failed fetch keeps the previous half and records the error.
 */
export async function refreshRealtime(env: Env, db: Db, now = new Date(), force = false): Promise<RealtimeSnapshot | null> {
  const key = env.TRANSIT_511_API_KEY;
  const previous = await loadSnapshot(db);
  if (!key) return previous;
  const want = force ? { trips: true, alerts: true } : due(now, Number(env.REALTIME_EVERY_MIN ?? 2));
  // A first run or a long gap fetches everything.
  if (!previous || now.getTime() - previous.fetched_at > 15 * 60_000) Object.assign(want, { trips: true, alerts: true });
  if (!want.trips && !want.alerts) return previous;

  const errors: string[] = [];
  const get = async (kind: "tripupdates" | "servicealerts") => fetchFeed(kind, key).catch((e: Error) => (errors.push(e.message), null));
  const [trips, alerts] = await Promise.all([want.trips ? get("tripupdates") : null, want.alerts ? get("servicealerts") : null]);
  if (!trips && !alerts) {
    if (errors.length) console.error("realtime:", errors.join("; "));
    return previous;
  }
  // fetched_at dates the trip updates (what "live" means on a board); a half not fetched this time
  // carries over from the previous snapshot.
  const merged: RealtimeSnapshot = {
    fetched_at: trips ? now.getTime() : previous?.fetched_at ?? now.getTime(),
    feed_ts: trips?.timestamp ?? previous?.feed_ts ?? null,
    trips: trips?.trips ?? previous?.trips ?? {},
    alerts: alerts?.alerts ?? previous?.alerts ?? [],
  };
  if (errors.length) console.error("realtime:", errors.join("; "));
  await storeSnapshot(db, merged, errors.length ? errors.join("; ") : null);
  return merged;
}
