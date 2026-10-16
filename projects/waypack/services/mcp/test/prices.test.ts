import { describe, expect, it } from "vitest";
import { unzipBundle, validateFiles, type BundleFile, type Manifest } from "@waypack/bundle-schema";
import type { Env } from "../src/env.js";
import type { Db } from "../src/lib/db.js";
import { publishBundle } from "../src/lib/pipeline.js";
import { mergePriceState } from "../src/lib/prices.js";
import { keys } from "../src/lib/storage.js";
import { tools, type ToolCtx } from "../src/mcp/tools.js";
import { ToolError } from "../src/mcp/protocol.js";

// ---- in-memory stand-ins: just enough PostgREST and R2 for publishing and the price tools
type Row = Record<string, unknown>;
const match = (row: Row, q: string) =>
  q.split("&").every((part) => {
    const [k, v] = part.split(/=(.*)/s);
    if (["select", "order", "limit", "or", "on_conflict"].includes(k)) return true;
    const val = decodeURIComponent(v ?? "");
    if (val.startsWith("eq.")) return String(row[k]) === val.slice(3);
    if (val.startsWith("not.in.(")) return !val.slice(8, -1).split(",").includes(String(row[k]));
    if (val === "is.null") return row[k] == null;
    return true;
  });
class FakeDb {
  tables: Record<string, Row[]> = {};
  async select<T>(t: string, q = "") { return (this.tables[t] ?? []).filter((r) => match(r, q)).map((r) => structuredClone(r)) as T[]; }
  async one<T>(t: string, q: string) { return ((await this.select<T>(t, q))[0] ?? null) as T | null; }
  async insert<T>(t: string, row: Row, opts: { upsert?: boolean; onConflict?: string } = {}) {
    const rows = (this.tables[t] ??= []);
    if (opts.upsert && opts.onConflict) {
      const cols = opts.onConflict.split(",");
      const have = rows.find((r) => cols.every((c) => r[c] === row[c]));
      if (have) return [structuredClone(Object.assign(have, row))] as T[];
    }
    const r = { id: crypto.randomUUID(), current_version: 0, deleted_at: null, ...row };
    rows.push(r);
    return [structuredClone(r)] as T[];
  }
  async update<T>(t: string, q: string, patch: Row) {
    const rows = (this.tables[t] ?? []).filter((r) => match(r, q));
    for (const r of rows) Object.assign(r, structuredClone(patch));
    return rows as T[];
  }
  async delete(t: string, q: string) { this.tables[t] = (this.tables[t] ?? []).filter((r) => !match(r, q)); return null; }
}
class FakeBucket {
  objects = new Map<string, Uint8Array>();
  async put(k: string, v: Uint8Array | string) { this.objects.set(k, typeof v === "string" ? new TextEncoder().encode(v) : new Uint8Array(v)); }
  async get(k: string) { const o = this.objects.get(k); return o ? { body: o, arrayBuffer: async () => o.slice().buffer } : null; }
}

const te = new TextEncoder();
const text = (path: string, t: string): BundleFile => ({ path, data: te.encode(t) });
const USER = "11111111-1111-4111-8111-111111111111";

// Thanksgiving at the lodge; trip dates relative to today so the rules see a future, unbooked trip.
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
function manifest(): Manifest {
  return {
    schema_version: 1, sdk_version: "1", trip_id: null, title: "Great Wolf Thanksgiving", summary: "Two nights at the lodge.",
    timezone: "UTC", start_date: day(45), end_date: day(46),
    map: { bbox: [-121.4, 38.6, -121.2, 38.8], max_zoom: 15, extra_areas: [] },
    places: [
      { id: "lodge-great-wolf", name: "Great Wolf Lodge", category: "lodging", lat: 38.7, lon: -121.3, cost: "$563 Flexible, 2 nights" },
      { id: "diner", name: "Diner", category: "food", lat: 38.71, lon: -121.31 },
    ],
    routes: [],
    days: [{ date: day(45), items: [{ time: "15:00", title: "Check in", place_id: "lodge-great-wolf", kind: "lodging" }] }, { date: day(46), items: [] }],
    live_checks: [{ label: "Roads", url: "https://quickmap.dot.ca.gov/" }],
    emergency: { numbers: [{ label: "Emergency", value: "911" }], places: [] },
    theme: { preset: "autumn" },
  } as Manifest;
}
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><script src="/__waypack/sdk/v1/waypack.js"></script></head>
<body><header data-waypack-bar><h1>Trip</h1></header><h2>Packing</h2><h2>Budget</h2><h2>Emergency</h2><h2>Backup plan</h2></body></html>`;
const bundle = (m: Manifest = manifest()) => [text("manifest.json", JSON.stringify(m)), text("index.html", html)];

function setup() {
  const db = new FakeDb();
  const bucket = new FakeBucket();
  const env = { PUBLIC_URL: "http://127.0.0.1:8787", BUCKET: bucket, SIGNING_SECRET: "test-secret", MAP_EXTRACTS: "device" } as unknown as Env;
  const ctx: ToolCtx = { env, db: db as unknown as Db, userId: USER };
  const call = (name: string, args: Record<string, unknown>) => tools.find((t) => t.name === name)!.run(args, ctx);
  return { db, bucket, env, ctx, call };
}
async function published(s: ReturnType<typeof setup>, m = manifest()) {
  const r = await publishBundle(s.env, s.ctx.db, USER, { files: bundle(m) });
  if (!r.ok) throw new Error(r.message);
  return r.trip_id;
}
const publishedManifest = (s: ReturnType<typeof setup>, tripId: string, version: number) =>
  JSON.parse(new TextDecoder().decode(unzipBundle(s.bucket.objects.get(keys.bundle(USER, tripId, version))!).files.find((f) => f.path === "manifest.json")!.data)) as Manifest;
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");

describe("price tools", () => {
  it("three snapshots with a promo deadline → book_now citing it; booked → none (acceptance §11)", async () => {
    const s = setup();
    const trip_id = await published(s);
    const deadline = day(3);
    const promo = `Flexible rate, 2 nights; Scary Savings promo ends ${deadline}`;
    const r1 = await s.call("record_price", { trip_id, place_id: "lodge-great-wolf", amount: 540, source: "greatwolf.com", note: promo, observed_at: ago(7) });
    expect(r1.structured).toMatchObject({ place_id: "lodge-great-wolf", snapshot_count: 1 });
    await s.call("record_price", { trip_id, place_id: "lodge-great-wolf", amount: 552, source: "greatwolf.com", observed_at: ago(3) });
    const r3 = await s.call("record_price", { trip_id, place_id: "lodge-great-wolf", amount: 563, source: "greatwolf.com" });
    expect(r3.structured!.snapshot_count).toBe(3);

    const sug = await s.call("suggest_booking_timing", { trip_id });
    const [one] = sug.structured!.suggestions as { place_id: string; verdict: string; reason: string }[];
    expect(one).toMatchObject({ place_id: "lodge-great-wolf", verdict: "book_now" });
    expect(one.reason).toContain("Scary Savings");
    expect(one.reason).toContain("in 3 days");
    expect(sug.text).toMatch(/BOOK NOW/);

    const h = await s.call("get_price_history", { trip_id, place_id: "lodge-great-wolf" });
    expect((h.structured!.places as { price_snapshots: unknown[] }[])[0].price_snapshots).toHaveLength(3);

    const b = await s.call("set_booking_status", { trip_id, place_id: "lodge-great-wolf", status: "booked" });
    expect(b.structured!.signal).toMatchObject({ verdict: "none", reason: "Already booked." });
    expect(((await s.call("suggest_booking_timing", { trip_id })).structured!.suggestions as { verdict: string }[])[0].verdict).toBe("none");

    // Republish (as from get_trip): the bundle carries the history, the Booked status and the signal.
    const m = manifest();
    m.trip_id = trip_id;
    const r = await publishBundle(s.env, s.ctx.db, USER, { files: bundle(m) });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const lodge = publishedManifest(s, trip_id, 2).places[0];
    expect(lodge.booking_status).toBe("booked");
    expect(lodge.price_snapshots).toHaveLength(3);
    expect(lodge.booking_signal?.verdict).toBe("none");
    expect(r.ok && r.warnings.map((w) => w.path)).not.toContain("places[0].booking_signal");
  });

  it("errors on unknown places, non-positive amounts, bad statuses and private details", async () => {
    const s = setup();
    const trip_id = await published(s);
    await expect(s.call("record_price", { trip_id, place_id: "nope", amount: 10 })).rejects.toThrow(/Unknown place_id `nope`/);
    await expect(s.call("record_price", { trip_id, place_id: "diner", amount: 0 })).rejects.toThrow(ToolError);
    await expect(s.call("record_price", { trip_id, place_id: "diner", amount: -5 })).rejects.toThrow(/greater than 0/);
    await expect(s.call("record_price", { trip_id, place_id: "diner", amount: 5, observed_at: "2026-10-04 12:00" })).rejects.toThrow(/time zone/);
    await expect(s.call("set_booking_status", { trip_id, place_id: "nope", status: "booked" })).rejects.toThrow(/Unknown place_id/);
    await expect(s.call("set_booking_status", { trip_id, place_id: "diner", status: "confirmed" })).rejects.toThrow(/unbooked, held, booked/);
    await expect(s.call("record_price", { trip_id, place_id: "diner", amount: 5, note: "Confirmation #GW88123" })).rejects.toThrow(/confirmation/);
    await expect(s.call("set_booking_status", { trip_id, place_id: "diner", status: "booked", note: "card ending in 4242" })).rejects.toThrow(/payment card/);
    expect(s.db.tables.place_price_snapshots ?? []).toEqual([]);
  });

  it("a deleted place takes its history with it", async () => {
    const s = setup();
    const trip_id = await published(s);
    await s.call("record_price", { trip_id, place_id: "diner", amount: 20 });
    await s.call("record_price", { trip_id, place_id: "lodge-great-wolf", amount: 500 });
    const m = manifest();
    m.trip_id = trip_id;
    m.places = m.places.filter((p) => p.id !== "diner");
    expect((await publishBundle(s.env, s.ctx.db, USER, { files: bundle(m) })).ok).toBe(true);
    expect(s.db.tables.place_price_snapshots.map((r) => r.place_id)).toEqual(["lodge-great-wolf"]);
  });

  it("computes signals for snapshots the agent wrote into the manifest itself", async () => {
    const s = setup();
    const m = manifest();
    m.places[0].price_snapshots = [{ observed_at: ago(2), amount: 500, currency: "USD" }, { observed_at: ago(1), amount: 560, currency: "USD" }];
    expect(validateFiles(bundle(m)).warnings.map((w) => w.path)).toContain("places[0].booking_signal");
    const trip_id = await published(s, m);
    expect(publishedManifest(s, trip_id, 1).places[0].booking_signal).toMatchObject({ verdict: "book_soon" });
  });

  it("no confirmation numbers or personal details reach the published bundle", async () => {
    const s = setup();
    const trip_id = await published(s);
    await s.call("record_price", { trip_id, place_id: "lodge-great-wolf", amount: 563, source: "greatwolf.com", note: "Flexible rate" });
    await s.call("set_booking_status", { trip_id, place_id: "lodge-great-wolf", status: "held", note: "holding for Sam until Friday" });
    const m = manifest();
    m.trip_id = trip_id;
    await publishBundle(s.env, s.ctx.db, USER, { files: bundle(m) });
    const out = JSON.stringify(publishedManifest(s, trip_id, 2));
    expect(out).not.toMatch(/Sam|holding|Confirmation/);
    expect(out).toContain('"booking_status":"held"');
  });
});

describe("authoring guide", () => {
  it("has the interview question, checklist item and Price tracking section", async () => {
    const g = (await setup().call("get_authoring_guide", {})).text;
    expect(g).toContain("Which bookings are price-sensitive? Any promo or sale deadlines I should know about?");
    expect(g).toContain("**Price history**: ≥ 1 snapshot recorded for each price-tracked place; signal verdict present");
    expect(g).toMatch(/## Price tracking[\s\S]*record_price[\s\S]*get_price_history[\s\S]*set_booking_status[\s\S]*suggest_booking_timing[\s\S]*\*\*Offline:\*\*[\s\S]*\*\*Privacy:\*\*/);
  });
});

describe("mergePriceState", () => {
  it("unions recorded and manifest snapshots without duplicating ones merged at the last publish", () => {
    const m = manifest();
    const snap = { observed_at: "2026-10-04T12:00:00-07:00", amount: 563, currency: "USD", source: "greatwolf.com" };
    m.places[0].price_snapshots = [snap];
    const row = { id: "x", trip_id: "t", user_id: USER, place_id: "lodge-great-wolf", created_at: "", ...snap };
    const later = { ...row, id: "y", observed_at: "2026-10-05T12:00:00-07:00", amount: 570 };
    const out = mergePriceState(m, { snapshots: [later, row], bookings: [] });
    expect(out.places[0].price_snapshots!.map((x) => x.amount)).toEqual([563, 570]);
    expect(out.places[0].booking_signal).toBeDefined();
    expect(out.places[1].booking_signal).toBeUndefined();
  });
});
