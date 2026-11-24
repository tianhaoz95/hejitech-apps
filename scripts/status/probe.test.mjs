// node --test scripts/status/probe.test.mjs (run by live-status.yml before every probe)
import assert from "node:assert/strict";
import test from "node:test";
import { classify, config, healthy, normalize, parseData, quotaLevel, record } from "./probe.mjs";

const T = [{ id: "a" }, { id: "b", expect: "reachable" }];

test("targets.json: unique ids, https urls", () => {
  const ids = config.targets.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of config.targets) assert.match(t.url, /^https:\/\//, t.id);
});

test("classify names Cloudflare's quota page and Worker errors", () => {
  assert.match(classify(429, "<title>Error 1027</title> This website has been temporarily rate limited"), /daily request limit/);
  assert.match(classify(500, "Error code: 1101"), /exception/);
  assert.match(classify(503, "upstream"), /Server error \(HTTP 503\)/);
  assert.match(classify(404, ""), /Not found/);
});

test("healthy: 2xx/3xx by default, below 500 for reachable", () => {
  assert.equal(healthy(T[0], 200), true);
  assert.equal(healthy(T[0], 404), false);
  assert.equal(healthy(T[1], 400), true);
  assert.equal(healthy(T[1], 502), false);
  assert.equal(healthy(T[1], 0), false);
});

test("normalize starts a document and rolls days, filling gaps", () => {
  let d = normalize(null, T, new Date("2026-11-20T10:00:00Z"));
  assert.deepEqual(d.days, ["2026-11-20"]);
  assert.deepEqual(d.targets.a.d, [null]);
  record(d.targets.a, { ok: true, code: 200, ms: 100 }, new Date("2026-11-20T10:00:00Z"));
  d = normalize(JSON.parse(JSON.stringify(d)), [...T, { id: "c" }], new Date("2026-11-23T00:01:00Z"));
  assert.deepEqual(d.days, ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]);
  assert.deepEqual(d.targets.a.d, [[1, 1, 100], null, null, null]);
  assert.equal(d.targets.c.d.length, 4);
  assert.equal(d.quota.totals.length, 4);
  d = normalize(d, [{ id: "a" }], new Date("2026-11-23T00:06:00Z"));
  assert.deepEqual(Object.keys(d.targets), ["a"]);
});

test("normalize keeps 90 days", () => {
  let d = normalize(null, T, new Date("2026-01-01T00:00:00Z"));
  d = normalize(d, T, new Date("2026-06-01T00:00:00Z"));
  assert.equal(d.days.length, 90);
  assert.equal(d.days.at(-1), "2026-06-01");
  assert.equal(d.targets.a.d.length, 90);
  assert.equal(d.quota.totals.length, 90);
});

test("record counts checks and reports state flips", () => {
  const now = new Date("2026-11-23T01:00:00Z");
  const d = normalize(null, T, now);
  const e = d.targets.a;
  assert.equal(record(e, { ok: true, code: 200, ms: 50 }, now), null); // unknown → up is not news
  assert.equal(record(e, { ok: false, code: 429, ms: 20, reason: "x" }, now), "down");
  assert.equal(record(e, { ok: false, code: 429, ms: 20, reason: "x" }, now), null);
  assert.equal(record(e, { ok: true, code: 200, ms: 70 }, now), "up");
  assert.deepEqual(e.d[0], [2, 4, 120]);
  assert.deepEqual(e.r, [50, -1, -1, 70]);
  assert.equal(record(d.targets.b, { ok: false, code: 0, ms: null, reason: "t" }, now), "down");
});

test("quotaLevel warns at 70% or when the pace passes the limit", () => {
  assert.equal(quotaLevel(70_000, 100_000, new Date("2026-11-23T20:00:00Z")).level, "high");
  assert.equal(quotaLevel(30_000, 100_000, new Date("2026-11-23T06:00:00Z")).level, "pace");
  assert.equal(quotaLevel(30_000, 100_000, new Date("2026-11-23T20:00:00Z")).level, null);
  assert.equal(quotaLevel(30_000, 100_000, new Date("2026-11-23T01:00:00Z")).level, null); // too early to judge pace
});

test("parseData reads the JSON block back", () => {
  const body = "intro\n\n```json\n{\"v\":1,\"days\":[]}\n```";
  assert.deepEqual(parseData(body), { v: 1, days: [] });
  assert.equal(parseData("nothing"), null);
  assert.equal(parseData(null), null);
});
