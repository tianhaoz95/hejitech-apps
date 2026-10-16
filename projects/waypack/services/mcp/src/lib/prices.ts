// Price tracking (DECISIONS #67). record_price / set_booking_status write here, outside the
// bundle, so a price check never mints a trip version. Whenever a manifest is published or
// previewed, the recorded state is merged into its places and every booking signal is recomputed
// and embedded: the bundle runs offline, so it only ever displays signals computed here.
import { applyBookingSignals, BOOKING_STATUSES, computeBookingSignal, type BookingSignal, type BookingStatus, type BundleFile, type Manifest, type Place, type PriceSnapshot } from "@waypack/bundle-schema";
import { Db, eq } from "./db.js";

export interface SnapshotRow extends PriceSnapshot {
  id: string;
  trip_id: string;
  user_id: string;
  place_id: string;
  currency: string;
  created_at: string;
}
export interface BookingRow { trip_id: string; user_id: string; place_id: string; status: BookingStatus; note: string | null; updated_at: string }

export class PriceError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PriceState { snapshots: SnapshotRow[]; bookings: BookingRow[] }

export async function loadPriceState(db: Db, userId: string, tripId: string): Promise<PriceState> {
  const q = `trip_id=${eq(tripId)}&user_id=${eq(userId)}`;
  const [snapshots, bookings] = await Promise.all([
    db.select<SnapshotRow>("place_price_snapshots", `select=*&${q}&order=observed_at.asc,created_at.asc`),
    db.select<BookingRow>("place_bookings", `select=*&${q}`),
  ]);
  return { snapshots, bookings };
}

const snapKey = (s: PriceSnapshot) => [Date.parse(s.observed_at), s.amount, s.currency ?? "USD", s.source ?? "", s.note ?? ""].join("|");
const toSnapshot = (r: SnapshotRow): PriceSnapshot => ({
  observed_at: r.observed_at,
  amount: Number(r.amount),
  currency: r.currency,
  ...(r.source ? { source: r.source } : {}),
  ...(r.note ? { note: r.note } : {}),
});

/**
 * Merges recorded prices and booking statuses into a manifest and recomputes every signal.
 * Snapshots are a union (the manifest may already carry ones merged at the last publish, or ones
 * the agent wrote itself); a recorded booking status wins over the manifest's.
 */
export function mergePriceState<M extends Manifest>(m: M, state: PriceState, now: Date = new Date()): M {
  const places = m.places.map((p): Place => {
    const recorded = state.snapshots.filter((s) => s.place_id === p.id).map(toSnapshot);
    const booking = state.bookings.find((b) => b.place_id === p.id);
    if (!recorded.length && !booking) return p;
    const seen = new Set<string>();
    const snaps = [...(p.price_snapshots ?? []), ...recorded]
      .filter((s) => {
        const k = snapKey(s);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
    return { ...p, ...(booking ? { booking_status: booking.status } : {}), ...(snaps.length || p.price_snapshots ? { price_snapshots: snaps } : {}) };
  });
  return applyBookingSignals({ ...m, places }, now);
}

/**
 * Applies the trip's price state to `manifest.json` in a file list. Returns the same files when
 * there's nothing price-related (or the manifest doesn't parse; the validator reports that), and
 * whether the trip has any recorded state.
 */
export async function withPriceState(db: Db, userId: string, tripId: string | null | undefined, files: BundleFile[], now = new Date()): Promise<{ files: BundleFile[]; recorded: boolean }> {
  const same = { files, recorded: false };
  const i = files.findIndex((f) => f.path === "manifest.json");
  if (i < 0) return same;
  let m: Manifest;
  try {
    m = JSON.parse(new TextDecoder().decode(files[i].data).replace(/^﻿/, "")) as Manifest;
  } catch {
    return same;
  }
  if (!m || !Array.isArray(m.places) || typeof m.timezone !== "string" || typeof m.start_date !== "string" || typeof m.end_date !== "string") return same;
  let state: PriceState = { snapshots: [], bookings: [] };
  if (tripId && UUID_RE.test(tripId)) {
    // Prices must never block a publish: on a database error, publish with what the manifest has.
    state = await loadPriceState(db, userId, tripId).catch((e) => {
      console.error("price state unavailable", e);
      return state;
    });
  }
  const tracked = m.places.some((p) => p && (Array.isArray(p.price_snapshots) || p.booking_status !== undefined || p.booking_signal !== undefined));
  const recorded = state.snapshots.length > 0 || state.bookings.length > 0;
  if (!tracked && !recorded) return same;
  const merged = mergePriceState(m, state, now);
  const out = files.slice();
  out[i] = { path: "manifest.json", data: new TextEncoder().encode(JSON.stringify(merged, null, 2)) };
  return { files: out, recorded };
}

/** History goes with the place: drops recorded prices for places the published manifest no longer has. */
export async function prunePriceState(db: Db, userId: string, tripId: string, placeIds: string[]): Promise<void> {
  const keep = placeIds.filter((id) => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(id));
  const q = `trip_id=${eq(tripId)}&user_id=${eq(userId)}${keep.length ? `&place_id=not.in.(${keep.join(",")})` : ""}`;
  await Promise.all([db.delete("place_price_snapshots", q), db.delete("place_bookings", q)]);
}

// ------------------------------------------------------------------ tool helpers

export interface TrackedPlace {
  place_id: string;
  name: string;
  booking_status: BookingStatus;
  price_snapshots: PriceSnapshot[];
  signal: BookingSignal;
}

/** Every tracked place of the merged manifest with a fresh signal. */
export function trackedPlaces(m: Manifest, now: Date = new Date()): TrackedPlace[] {
  return m.places.flatMap((p) => {
    const signal = computeBookingSignal(p, m, now);
    if (!signal) return [];
    return [{ place_id: p.id, name: p.name, booking_status: p.booking_status ?? "unbooked", price_snapshots: p.price_snapshots ?? [], signal }];
  });
}

export function bookingStatusArg(v: unknown): BookingStatus {
  if (typeof v !== "string" || !BOOKING_STATUSES.includes(v as BookingStatus)) throw new PriceError(`\`status\` must be one of: ${BOOKING_STATUSES.join(", ")}.`);
  return v as BookingStatus;
}

const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
export function observedAtArg(v: unknown, now: Date): string {
  if (v === undefined || v === null || v === "") return now.toISOString();
  if (typeof v !== "string" || !ISO_TZ.test(v) || Number.isNaN(Date.parse(v))) {
    throw new PriceError("`observed_at` must be ISO-8601 with a time zone, e.g. 2026-10-04T12:00:00-07:00 (omit it for now).");
  }
  if (Date.parse(v) > now.getTime() + 5 * 60_000) throw new PriceError("`observed_at` is in the future; use when the price was actually seen.");
  return v;
}
