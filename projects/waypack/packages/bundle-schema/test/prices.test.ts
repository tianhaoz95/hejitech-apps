import { describe, expect, it } from "vitest";
import { applyBookingSignals, computeBookingSignal, parseDeadline, privateDetailReason, validateFiles, type Place } from "../src/index.js";
import { baseManifest, goodBundle } from "./helpers.js";

// Trip Nov 26–28; "now" is Oct 11, 18:00 in Los Angeles.
const trip = { start_date: "2026-11-26", end_date: "2026-11-28", timezone: "America/Los_Angeles" };
const NOW = new Date("2026-10-12T01:00:00Z");
const lodge = (over: Partial<Place> = {}): Place => ({ id: "lodge", name: "Great Wolf Lodge", category: "lodging", lat: 38.7, lon: -121.3, ...over });
const snap = (day: string, amount: number, note?: string, currency?: string) => ({ observed_at: `${day}T12:00:00-07:00`, amount, source: "greatwolf.com", ...(note ? { note } : {}), ...(currency ? { currency } : {}) });

describe("parseDeadline", () => {
  it("reads the documented forms", () => {
    expect(parseDeadline("Scary Savings promo ends Oct 11", "2026-10-04")).toBe("2026-10-11");
    expect(parseDeadline("sale ends 2026-10-11", "2026-10-04")).toBe("2026-10-11");
    expect(parseDeadline("Rate good until October 31, 2026", "2026-10-04")).toBe("2026-10-31");
    expect(parseDeadline("expires 11 Oct", "2026-10-04")).toBe("2026-10-11");
    expect(parseDeadline("book by 10/15", "2026-10-04")).toBe("2026-10-15");
    expect(parseDeadline("Deadline: Jan 3", "2026-12-20")).toBe("2027-01-03");
  });
  it("ignores notes without a cue or a real date", () => {
    expect(parseDeadline("Flexible rate, 2 nights", "2026-10-04")).toBeNull();
    expect(parseDeadline("ends Feb 30", "2026-10-04")).toBeNull();
    expect(parseDeadline(undefined, "2026-10-04")).toBeNull();
  });
});

describe("computeBookingSignal", () => {
  it("is book_now when a promo deadline is within 7 days, citing it (acceptance §11)", () => {
    const p = lodge({
      price_snapshots: [snap("2026-10-04", 540, "Flexible rate, 2 nights; Scary Savings promo ends Oct 11"), snap("2026-10-08", 552), snap("2026-10-11", 563)],
    });
    const s = computeBookingSignal(p, trip, NOW)!;
    expect(s.verdict).toBe("book_now");
    expect(s.reason).toContain("Oct 11");
    expect(s.reason).toContain("today");
    expect(s.reason).toContain("Scary Savings");
    expect(s.computed_at).toBe(NOW.toISOString());
  });
  it("deadline beats trend; trend beats proximity", () => {
    const up = [snap("2026-10-01", 500), snap("2026-10-10", 540)];
    expect(computeBookingSignal(lodge({ price_snapshots: [...up.slice(0, 1), { ...up[1], note: "promo ends Oct 14" }] }), trip, NOW)!.verdict).toBe("book_now");
    const s = computeBookingSignal(lodge({ price_snapshots: up }), trip, NOW)!;
    expect(s.verdict).toBe("book_soon");
    expect(s.reason).toMatch(/Price up 8% since Oct 1: \$540 on Oct 10 vs \$500 first seen Oct 1/);
    const near = { ...trip, start_date: "2026-10-20", end_date: "2026-10-22" };
    expect(computeBookingSignal(lodge({ price_snapshots: [snap("2026-10-01", 500), snap("2026-10-10", 450)] }), near, NOW)!.verdict).toBe("good_time");
    const s2 = computeBookingSignal(lodge({ price_snapshots: [snap("2026-10-01", 500), snap("2026-10-10", 505)] }), near, NOW)!;
    expect(s2.verdict).toBe("book_soon");
    expect(s2.reason).toMatch(/Trip starts in 9 days/);
  });
  it("is stable within ±5%, and good_time on a 5% drop", () => {
    expect(computeBookingSignal(lodge({ price_snapshots: [snap("2026-10-01", 500), snap("2026-10-10", 510)] }), trip, NOW)!.verdict).toBe("stable");
    expect(computeBookingSignal(lodge({ price_snapshots: [snap("2026-10-01", 500), snap("2026-10-10", 475)] }), trip, NOW)!.verdict).toBe("good_time");
  });
  it("notes a single observation and uses deadline/proximity only", () => {
    const s = computeBookingSignal(lodge({ price_snapshots: [snap("2026-10-04", 563)] }), trip, NOW)!;
    expect(s.verdict).toBe("stable");
    expect(s.reason).toMatch(/only one observation so far/i);
  });
  it("mentions a passed deadline without acting on it", () => {
    const s = computeBookingSignal(lodge({ price_snapshots: [snap("2026-10-01", 500, "promo ends Oct 5"), snap("2026-10-10", 505)] }), trip, NOW)!;
    expect(s.verdict).toBe("stable");
    expect(s.reason).toMatch(/has passed/);
  });
  it("is none when booked or held, for a past trip, or with mixed currencies", () => {
    const snaps = [snap("2026-10-04", 563, "promo ends Oct 11")];
    expect(computeBookingSignal(lodge({ booking_status: "booked", price_snapshots: snaps }), trip, NOW)).toMatchObject({ verdict: "none", reason: "Already booked." });
    expect(computeBookingSignal(lodge({ booking_status: "held", price_snapshots: snaps }), trip, NOW)!.verdict).toBe("none");
    expect(computeBookingSignal(lodge({ price_snapshots: snaps }), { ...trip, start_date: "2026-09-01", end_date: "2026-09-03" }, NOW)).toMatchObject({ verdict: "none", reason: "Trip completed." });
    const mixed = computeBookingSignal(lodge({ price_snapshots: [snap("2026-10-04", 563), snap("2026-10-05", 500, undefined, "EUR")] }), trip, NOW)!;
    expect(mixed.verdict).toBe("none");
    expect(mixed.reason).toMatch(/mixed currencies/i);
  });
  it("only tracks places with snapshots or a booking status", () => {
    expect(computeBookingSignal(lodge(), trip, NOW)).toBeUndefined();
    expect(computeBookingSignal(lodge({ price_snapshots: [] }), trip, NOW)!.verdict).toBe("none");
  });
  it("applyBookingSignals embeds signals and drops stale ones from untracked places", () => {
    const m = { ...baseManifest(), ...trip };
    m.places = [lodge({ price_snapshots: [snap("2026-10-04", 563)] }), { ...m.places[1], booking_signal: { verdict: "stable", reason: "old" } }];
    const out = applyBookingSignals(m, NOW);
    expect(out.places[0].booking_signal?.verdict).toBe("stable");
    expect(out.places[1].booking_signal).toBeUndefined();
    expect(m.places[1].booking_signal).toBeDefined();
  });
});

describe("privateDetailReason", () => {
  it("flags booking codes and card numbers, not ordinary notes", () => {
    expect(privateDetailReason("Confirmation #AB12CD")).toMatch(/confirmation/);
    expect(privateDetailReason("paid with 4111 1111 1111 1111")).toMatch(/card/);
    expect(privateDetailReason("Visa ending in 4242")).toMatch(/card/);
    expect(privateDetailReason("Reservation recommended; promo ends Oct 11")).toBeNull();
    expect(privateDetailReason("Flexible rate, 2 nights")).toBeNull();
  });
});

describe("validator", () => {
  const withLodge = (p: Record<string, unknown>) => {
    const m = baseManifest() as any;
    Object.assign(m.places[0], p);
    return validateFiles(goodBundle(m));
  };
  it("warns on snapshots without a signal and on tracked places with no observations", () => {
    const r = withLodge({ price_snapshots: [snap("2026-10-04", 563)] });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.path)).toContain("places[0].booking_signal");
    const r2 = withLodge({ price_snapshots: [] });
    expect(r2.warnings.find((w) => w.path === "places[0].price_snapshots")?.message).toMatch(/no observations yet/);
    const r3 = withLodge({ price_snapshots: [snap("2026-10-04", 563)], booking_signal: { verdict: "stable", reason: "x" } });
    expect(r3.warnings).toEqual([]);
  });
  it("errors on a bad booking_status, missing fields, non-positive amounts and private notes", () => {
    expect(withLodge({ booking_status: "confirmed" }).errors.map((e) => e.path)).toContain("places[0].booking_status");
    const r = withLodge({ price_snapshots: [{ amount: 10 }, { observed_at: "2026-10-04T12:00:00-07:00" }, { observed_at: "2026-10-04T12:00:00-07:00", amount: 0 }, { observed_at: "2026-10-04", amount: 5 }] });
    const paths = r.errors.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(["places[0].price_snapshots[0].observed_at", "places[0].price_snapshots[1].amount", "places[0].price_snapshots[2].amount", "places[0].price_snapshots[3].observed_at"]));
    expect(r.errors.find((e) => e.path === "places[0].price_snapshots[3].observed_at")?.hint).toMatch(/time zone/);
    const p = withLodge({ price_snapshots: [snap("2026-10-04", 563, "Conf# 88X41K")], booking_signal: { verdict: "stable", reason: "x" } });
    expect(p.errors.map((e) => e.path)).toContain("places[0].price_snapshots[0].note");
  });
});
