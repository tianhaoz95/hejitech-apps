// node --test --experimental-strip-types test/*.test.ts (npm test -w @contempo/web)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entry } from "../src/lib/entryModel.ts";
import { dashboardMetrics, testYearProgress } from "../src/lib/metrics.ts";

const at = { toDate: () => new Date("2026-10-15T10:00:00Z") } as Entry["activityDate"];
// Pinned so the year these entries fall in doesn't depend on when the tests run.
const NOW = new Date(2026, 9, 21, 12);
const metrics = (entries: Entry[]) => dashboardMetrics(entries, NOW);

function entry(over: Partial<Entry>): Entry {
  return {
    id: Math.random().toString(36).slice(2), propertyId: "p1", propertyName: "Lake House", task: "Turnover",
    durationMinutes: 60, category: "turnover", status: "confirmed", source: "manual",
    activityDate: at, loggedAt: at, confirmedAt: at, isVague: false, isBackfilled: false, daysLate: 0,
    riskReasons: [], photoUrls: [], roleId: "", roleName: "", inProgress: false, ...over,
  };
}

test("only the owner's confirmed hours count toward the test", () => {
  const m = metrics([
    entry({ durationMinutes: 120 }),
    entry({ durationMinutes: 90, roleId: "r-clean", roleName: "Cleaner" }),
    entry({ durationMinutes: 30, status: "pending_review" }),
  ]);
  assert.equal(m.confirmedHours, 2);
});

test("role breakdown: Me first, then other roles by hours", () => {
  const m = metrics([
    entry({ durationMinutes: 60 }),
    entry({ durationMinutes: 90, roleId: "r-clean", roleName: "Cleaner" }),
    entry({ durationMinutes: 90, roleId: "r-clean", roleName: "Cleaner" }),
    entry({ durationMinutes: 120, roleId: "r-cohost", roleName: "Co-host" }),
  ]);
  assert.deepEqual(m.roleBreakdown, [
    { id: "", name: "Me", hours: 1 },
    { id: "r-clean", name: "Cleaner", hours: 3 },
    { id: "r-cohost", name: "Co-host", hours: 2 },
  ]);
});

test("no breakdown when only the owner logged hours; unnamed roles read Other", () => {
  assert.deepEqual(metrics([entry({})]).roleBreakdown, []);
  const m = metrics([entry({}), entry({ roleId: "r-x" })]);
  assert.equal(m.roleBreakdown[1].name, "Other");
});

test("open timers and trips aren't pending review", () => {
  const m = metrics([
    entry({ status: "pending_review" }),
    entry({ status: "pending_review", inProgress: true }),
  ]);
  assert.equal(m.pendingCount, 1);
});

const on = (y: number, m: number, d: number, h = 12) => ({ toDate: () => new Date(y, m - 1, d, h) }) as Entry["activityDate"];

test("the tests are annual: last year's hours don't count", () => {
  const p = testYearProgress(
    [entry({ durationMinutes: 100 * 60, activityDate: on(2026, 11, 5) }), entry({ durationMinutes: 90, activityDate: on(2027, 1, 1) })],
    new Date(2027, 0, 2, 12),
  );
  assert.equal(p.year, 2027);
  assert.equal(p.ownerHours, 1.5);
  assert.notEqual(p.pace.kind, "met");
});

test("New Year's Eve late at night stays in the old year", () => {
  const p = testYearProgress([entry({ durationMinutes: 60, activityDate: on(2026, 12, 31, 23) })], new Date(2026, 11, 31, 23));
  assert.equal(p.year, 2026);
  assert.equal(p.ownerHours, 1);
});

test("reaching the threshold is met", () => {
  assert.deepEqual(testYearProgress([entry({ durationMinutes: 100 * 60, activityDate: on(2026, 6, 1) })], NOW).pace, { kind: "met" });
});

test("a slow pace asks for weekly hours to Dec 31", () => {
  const p = testYearProgress([entry({ durationMinutes: 50 * 60, activityDate: on(2026, 7, 1) })], NOW);
  assert.equal(p.pace.kind, "behind");
  if (p.pace.kind === "behind") assert.ok(Math.abs(p.pace.weeklyHoursNeeded - (50 / 72) * 7) < 1e-9);
});

test("a fast pace projects a finish date", () => {
  const p = testYearProgress([entry({ durationMinutes: 80 * 60, activityDate: on(2026, 7, 1) })], NOW);
  assert.deepEqual(p.pace, { kind: "onPace", finish: new Date(2026, 10, 19) });
});

test("the pace window has a minimum", () => {
  const p = testYearProgress([entry({ durationMinutes: 10 * 60, activityDate: on(2026, 3, 1) })], new Date(2026, 2, 2, 12));
  assert.deepEqual(p.pace, { kind: "onPace", finish: new Date(2026, 6, 6) });
});

test("no hours yet asks for weekly hours", () => {
  const p = testYearProgress([], new Date(2026, 0, 1, 12));
  assert.equal(p.pace.kind, "behind");
  if (p.pace.kind === "behind") assert.ok(Math.abs(p.pace.weeklyHoursNeeded - (100 / 365) * 7) < 1e-9);
});

test("the dashboard compares roles within the same year", () => {
  const m = dashboardMetrics(
    [
      entry({ durationMinutes: 100 * 60, activityDate: on(2026, 11, 5) }),
      entry({ durationMinutes: 600, activityDate: on(2026, 11, 5), roleId: "r-clean", roleName: "Cleaner" }),
      entry({ durationMinutes: 60, activityDate: on(2027, 1, 1) }),
    ],
    new Date(2027, 0, 2, 12),
  );
  assert.equal(m.confirmedHours, 1);
  assert.deepEqual(m.roleBreakdown, []);
});
