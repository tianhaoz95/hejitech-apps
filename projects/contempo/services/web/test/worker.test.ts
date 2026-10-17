// node --test --experimental-strip-types test/*.test.ts (npm test -w @contempo/web)
import { test } from "node:test";
import assert from "node:assert/strict";
import { flagRisk } from "../src/worker/index.ts";

test("flagRisk: same heuristics as the old Genkit flow", () => {
  const ok = flagRisk({ task: "Replaced the kitchen faucet cartridge", durationMinutes: 45, activityDateIso: "2026-10-15T10:00:00Z", loggedAtIso: "2026-10-16T10:00:00Z" });
  assert.deepEqual(ok, { isVague: false, isBackfilled: false, daysLate: 1, reasons: [] });
  const bad = flagRisk({ task: "worked on the house", durationMinutes: 600, activityDateIso: "2026-09-01T00:00:00Z", loggedAtIso: "2026-10-16T00:00:00Z" });
  assert.equal(bad.isVague, true);
  assert.equal(bad.isBackfilled, true);
  assert.equal(bad.daysLate, 45);
  assert.equal(bad.reasons.length, 3);
});
