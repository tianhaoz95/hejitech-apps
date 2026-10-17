// node --test --experimental-strip-types test/*.test.ts (npm test -w @contempo/web)
import { test } from "node:test";
import assert from "node:assert/strict";
import { flagRisk, isoWeekId, isoWeekStart } from "../src/worker/index.ts";

test("flagRisk: same heuristics as the old Genkit flow", () => {
  const ok = flagRisk({ task: "Replaced the kitchen faucet cartridge", durationMinutes: 45, activityDateIso: "2026-10-15T10:00:00Z", loggedAtIso: "2026-10-16T10:00:00Z" });
  assert.deepEqual(ok, { isVague: false, isBackfilled: false, daysLate: 1, reasons: [] });
  const bad = flagRisk({ task: "worked on the house", durationMinutes: 600, activityDateIso: "2026-09-01T00:00:00Z", loggedAtIso: "2026-10-16T00:00:00Z" });
  assert.equal(bad.isVague, true);
  assert.equal(bad.isBackfilled, true);
  assert.equal(bad.daysLate, 45);
  assert.equal(bad.reasons.length, 3);
});

test("ISO weeks match the clients' week ids", () => {
  assert.equal(isoWeekId(new Date("2026-10-16T12:00:00Z")), "2026-W42");
  assert.equal(isoWeekId(new Date("2027-01-01T12:00:00Z")), "2026-W53");
  assert.equal(isoWeekStart(new Date("2026-10-18T23:00:00Z")).toISOString(), "2026-10-12T00:00:00.000Z");
});
