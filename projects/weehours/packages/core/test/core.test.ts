// Runs the shared fixtures (spec/fixtures/status.json) against the TypeScript core, the same file
// the Swift LogCore tests read.
import { describe, expect, it } from "vitest";
import fixtures from "../../../spec/fixtures/status.json";
import { dailySummary, derive, photoCounts, status, statusLine, validate, type LogEvent } from "../src/core.ts";

const now = Date.parse(fixtures.now);

describe("shared status fixtures", () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const ids = new Map<string, string>(Object.entries(fixtures.caregivers));
      const id = (s: string) => {
        if (!ids.has(s)) ids.set(s, crypto.randomUUID());
        return ids.get(s)!;
      };
      const events: LogEvent[] = c.events.map((e: Record<string, any>) => {
        const fields: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(e.fields ?? {})) fields[k] = ["original", "duplicate", "caregiver"].includes(k) ? id(String(v)) : (v as string | number);
        const occurred = new Date(now - e.minutes_ago * 60_000).toISOString();
        return {
          id: id(e.id), household_id: "h", baby_id: id(e.baby ?? "b"), type: e.type, fields, occurred_at: occurred,
          logged_at: e.logged_minutes_ago !== undefined ? new Date(now - e.logged_minutes_ago * 60_000).toISOString() : occurred,
          logged_by: id(e.by), provenance: { surface: e.surface ?? "phone", input: "tap" }, supersedes: e.supersedes ? id(e.supersedes) : null,
        };
      });
      const d = derive(events, (c as { for_baby?: string }).for_baby ? id((c as { for_baby: string }).for_baby) : undefined);
      const s = status(d);
      const x = c.expect as Record<string, any>;
      if (x.line !== undefined) expect(statusLine(s, now)).toBe(x.line);
      if (x.to_review !== undefined) expect(s.to_review).toBe(x.to_review);
      if (x.last_feed_kind !== undefined) expect(s.last_feed_kind).toBe(x.last_feed_kind);
      if (x.open_feed_kind !== undefined) expect(s.open_feed_kind).toBe(x.open_feed_kind);
      if (x.next_side !== undefined) expect(s.next_side).toBe(x.next_side);
      if (x.sleeping !== undefined) expect(s.sleeping_since !== undefined).toBe(x.sleeping);
      if (x.sessions !== undefined) expect(d.sessions.length).toBe(x.sessions);
      if (x.on_duty !== undefined) expect(s.on_duty).toBe(id(x.on_duty));
      for (const [k, v] of Object.entries(x.status ?? {})) expect(d.status.get(id(k))).toBe(v);
    });
  }
});

describe("validation", () => {
  it("matches the phone rules", () => {
    expect(validate("diaper", { kind: "wet" })).toBeNull();
    expect(validate("diaper", {})).toMatch(/needs kind/);
    expect(validate("diaper", { needs_details: true })).toBeNull();   // watch tilt: kind asked later
    expect(validate("diaper", { kind: "purple" })).toMatch(/invalid kind/);
    expect(validate("diaper", { kind: "dirty", stool_color: "green" })).toBeNull();
    expect(validate("diaper", { kind: "dirty", stool_color: "purple" })).toMatch(/invalid stool_color/);
    expect(validate("feed.bottle.finish", { consumed_fraction: 1.5 })).toMatch(/consumed_fraction/);
    expect(validate("nope", {})).toMatch(/unknown type/);
    expect(validate("feed.bottle.start", {}, ["diaper"])).toMatch(/turned off/);
    expect(validate("height", { height_cm: 52 })).toBeNull();
    expect(validate("height", {})).toMatch(/needs height_cm/);
    expect(validate("head", { head_cm: 0 })).toMatch(/head_cm/);
  });

  it("checks the spec-described fields of the tap-logged types like the phone", () => {
    expect(validate("bath", {})).toBeNull();
    expect(validate("medication", { medicine: "Vitamin D", dose: "1 drop" })).toBeNull();
    expect(validate("medication", {})).toMatch(/needs medicine/);
    expect(validate("medication", { medicine: " " })).toMatch(/non-empty/);
    expect(validate("symptom", { symptom: "runny_nose" })).toBeNull();
    expect(validate("symptom", { symptom: "sneezing" })).toMatch(/invalid symptom/);
    expect(validate("temperature", { temp_c: 38.2 })).toBeNull();
    expect(validate("temperature", {})).toMatch(/needs temp_c/);
    expect(validate("tummy_time", {})).toBeNull();
    expect(validate("tummy_time", { minutes: 0 })).toMatch(/minutes/);
    expect(validate("potty", { result: "tried" }, ["diaper"])).toMatch(/turned off/);
  });
});

describe("dailySummary", () => {
  it("computes accurate daily feed volume, diapers, sleep duration and wake windows", () => {
    const today = "2026-10-22";
    const bId = "baby-1";
    const events: LogEvent[] = [
      {
        id: "e1", household_id: "h", baby_id: bId, type: "feed.bottle.single",
        fields: { consumed_ml: 120, contents: "formula" },
        occurred_at: `${today}T08:00:00.000Z`, logged_at: `${today}T08:00:00.000Z`,
        logged_by: "p1", provenance: { surface: "phone", input: "tap" }, supersedes: null,
      },
      {
        id: "e2", household_id: "h", baby_id: bId, type: "diaper",
        fields: { kind: "wet" },
        occurred_at: `${today}T09:00:00.000Z`, logged_at: `${today}T09:00:00.000Z`,
        logged_by: "p1", provenance: { surface: "phone", input: "tap" }, supersedes: null,
      },
      {
        id: "e3", household_id: "h", baby_id: bId, type: "diaper",
        fields: { kind: "both", stool_color: "yellow" },
        occurred_at: `${today}T11:00:00.000Z`, logged_at: `${today}T11:00:00.000Z`,
        logged_by: "p1", provenance: { surface: "phone", input: "tap" }, supersedes: null,
      },
      {
        id: "e4", household_id: "h", baby_id: bId, type: "sleep.start",
        fields: {},
        occurred_at: `${today}T12:00:00.000Z`, logged_at: `${today}T12:00:00.000Z`,
        logged_by: "p1", provenance: { surface: "phone", input: "tap" }, supersedes: null,
      },
      {
        id: "e5", household_id: "h", baby_id: bId, type: "sleep.end",
        fields: {},
        occurred_at: `${today}T13:30:00.000Z`, logged_at: `${today}T13:30:00.000Z`,
        logged_by: "p1", provenance: { surface: "phone", input: "tap" }, supersedes: null,
      },
      {
        id: "e6", household_id: "h", baby_id: bId, type: "medication",
        fields: { medicine: "Acetaminophen", dose: "1.25 ml" },
        occurred_at: `${today}T14:00:00.000Z`, logged_at: `${today}T14:00:00.000Z`,
        logged_by: "p1", provenance: { surface: "phone", input: "tap" }, supersedes: null,
      },
    ];

    const d = derive(events, bId);
    const testNow = new Date(`${today}T15:00:00.000Z`).getTime();
    const summary = dailySummary(d, today, () => 120, testNow);

    expect(summary.date).toBe(today);
    expect(summary.feeds.total_bottle_ml).toBe(120);
    expect(summary.feeds.total_feed_count).toBe(1);
    expect(summary.diapers.wet_count).toBe(2);
    expect(summary.diapers.dirty_count).toBe(1);
    expect(summary.diapers.both_count).toBe(1);
    expect(summary.diapers.total_count).toBe(2);
    expect(summary.sleep.total_sleep_minutes).toBe(90);
    expect(summary.sleep.longest_stretch_minutes).toBe(90);
    expect(summary.sleep.session_count).toBe(1);
    expect(summary.sleep.current_wake_window_minutes).toBe(90); // 13:30 to 15:00 is 90 mins
    expect(summary.medications.length).toBe(1);
    expect(summary.medications[0].medicine).toBe("Acetaminophen");
  });
});

describe("photos", () => {
  const at = (m: number) => new Date(Date.parse("2026-10-20T12:00:00Z") + m * 60_000).toISOString();
  const ev = (id: string, type: string, m: number, fields: Record<string, string | number> = {}, supersedes: string | null = null): LogEvent => ({
    id, household_id: "h", baby_id: "b", type, fields, occurred_at: at(m), logged_at: at(m), logged_by: "a",
    provenance: { surface: "phone", input: "tap" }, supersedes,
  });

  it("counts an entry's photos through its edits, not undone ones, and keeps them out of the log", () => {
    const events = [
      ev("d1", "diaper", 0, { kind: "wet" }),
      ev("p1", "photo", 1, { attached_to: "d1", path: "photos/p1.jpg" }),
      ev("d2", "diaper", 2, { kind: "dirty" }, "d1"),
      ev("p2", "photo", 3, { attached_to: "d2", path: "photos/p2.jpg" }),
      ev("p3", "photo", 4, { attached_to: "d2", path: "photos/p3.jpg" }),
      ev("u1", "undo", 5, {}, "p3"),
    ];
    const d = derive(events);
    expect(d.effective.map((e) => e.id)).toEqual(["d2"]);
    expect(photoCounts(d)(d.effective[0])).toBe(2);
    expect(validate("photo", {})).toBeNull();
  });
});
