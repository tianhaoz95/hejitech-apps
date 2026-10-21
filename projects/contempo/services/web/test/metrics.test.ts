// node --test --experimental-strip-types test/*.test.ts (npm test -w @contempo/web)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Entry } from "../src/lib/entryModel.ts";
import { dashboardMetrics } from "../src/lib/metrics.ts";

const at = { toDate: () => new Date("2026-10-15T10:00:00Z") } as Entry["activityDate"];
function entry(over: Partial<Entry>): Entry {
  return {
    id: Math.random().toString(36).slice(2), propertyId: "p1", propertyName: "Lake House", task: "Turnover",
    durationMinutes: 60, category: "turnover", status: "confirmed", source: "manual",
    activityDate: at, loggedAt: at, confirmedAt: at, isVague: false, isBackfilled: false, daysLate: 0,
    riskReasons: [], photoUrls: [], roleId: "", roleName: "", inProgress: false, ...over,
  };
}

test("only the owner's confirmed hours count toward the test", () => {
  const m = dashboardMetrics([
    entry({ durationMinutes: 120 }),
    entry({ durationMinutes: 90, roleId: "r-clean", roleName: "Cleaner" }),
    entry({ durationMinutes: 30, status: "pending_review" }),
  ]);
  assert.equal(m.confirmedHours, 2);
});

test("role breakdown: Me first, then other roles by hours", () => {
  const m = dashboardMetrics([
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
  assert.deepEqual(dashboardMetrics([entry({})]).roleBreakdown, []);
  const m = dashboardMetrics([entry({}), entry({ roleId: "r-x" })]);
  assert.equal(m.roleBreakdown[1].name, "Other");
});

test("open timers and trips aren't pending review", () => {
  const m = dashboardMetrics([
    entry({ status: "pending_review" }),
    entry({ status: "pending_review", inProgress: true }),
  ]);
  assert.equal(m.pendingCount, 1);
});
