// Runs the shared fixtures (spec/fixtures/status.json) against the TypeScript core, the same file
// the Swift LogCore tests read.
import { describe, expect, it } from "vitest";
import fixtures from "../../../spec/fixtures/status.json";
import { derive, status, statusLine, validate, type LogEvent } from "../src/core.ts";

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
    expect(validate("diaper", { kind: "purple" })).toMatch(/invalid kind/);
    expect(validate("feed.bottle.finish", { consumed_fraction: 1.5 })).toMatch(/consumed_fraction/);
    expect(validate("nope", {})).toMatch(/unknown type/);
    expect(validate("feed.bottle.start", {}, ["diaper"])).toMatch(/turned off/);
    expect(validate("height", { height_cm: 52 })).toBeNull();
    expect(validate("height", {})).toMatch(/needs height_cm/);
    expect(validate("head", { head_cm: 0 })).toMatch(/head_cm/);
  });
});
