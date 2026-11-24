#!/usr/bin/env node
// The live status probe (live-status.yml, every 5 minutes): checks every production surface in
// targets.json from GitHub Actions, outside Cloudflare, so a Worker or the whole account going down
// (G2 Digest's runaway traffic used up the account's daily request limit once) still gets seen.
//
// No git writes: history lives as JSON in one locked GitHub issue labeled `status-data`, which the
// live page (pages/.vitepress/theme/LiveStatus.vue) reads from the GitHub API. A data branch would
// start Cloudflare Workers Builds preview builds on every push. Outages open an issue labeled
// `incident` (GitHub notifies the owner) that closes itself on recovery; the Cloudflare account's
// request count for the day (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_ANALYTICS_TOKEN) opens a `quota`
// issue at 70% of the free plan's daily limit, or earlier when the day's pace would pass it.
//
//   node scripts/status/probe.mjs --dry-run    # check and print, write nothing (no token needed)
//
// Products being down is not a failure of this script: it exits 0 unless the script itself breaks.
import { readFileSync } from "node:fs";

const REPO = process.env.GITHUB_REPOSITORY || "tianhaoz95/hejitech-apps";
const OWNER = REPO.split("/")[0];
const PAGE = "https://tianhaoz95.github.io/hejitech-apps/live";
const DAYS = 90; // days of uptime history kept
const RECENT = 36; // last response times kept per target (3 hours at 5 minutes)
const QUOTA_DAYS = 30; // days of per-Worker request counts kept
const TIMEOUT_MS = 15_000;
const RETRY_MS = 20_000; // a failed check is retried once before it counts as down
const WARN_AT = 0.7;

export const config = JSON.parse(readFileSync(new URL("./targets.json", import.meta.url), "utf8"));

// ---------- checks ----------

/** Why a response isn't healthy, in words; Cloudflare's own error pages carry "Error 1xxx". */
export function classify(code, body = "") {
  const cf = body.match(/Error\s*(?:code:?\s*)?(1\d{3})\b/i)?.[1];
  if (cf === "1027") return "Cloudflare's daily request limit for the account is used up (error 1027)";
  if (cf === "1101") return "The Worker threw an exception (Cloudflare error 1101)";
  if (cf === "1102") return "The Worker ran out of CPU time (Cloudflare error 1102)";
  if (cf) return `Cloudflare error ${cf} (HTTP ${code})`;
  if (code === 429) return "Rate limited (HTTP 429)";
  if (code === 404) return "Not found (HTTP 404)";
  if (code >= 500) return `Server error (HTTP ${code})`;
  return `Unexpected answer (HTTP ${code})`;
}

export function healthy(target, code) {
  return target.expect === "reachable" ? code > 0 && code < 500 : code >= 200 && code < 400;
}

async function check(target) {
  const start = performance.now();
  try {
    const r = await fetch(target.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": `heji-status-probe (+${PAGE})`, "cache-control": "no-cache" },
    });
    const body = await r.text(); // read it all: the time includes the body
    const ms = Math.round(performance.now() - start);
    const ok = healthy(target, r.status);
    return { ok, code: r.status, ms, reason: ok ? null : classify(r.status, body.slice(0, 20_000)) };
  } catch (e) {
    const timeout = e?.name === "TimeoutError" || e?.name === "AbortError";
    return { ok: false, code: 0, ms: null, reason: timeout ? `No answer within ${TIMEOUT_MS / 1000} s` : `Connection failed (${e?.cause?.code ?? e?.message ?? e})` };
  }
}

async function checkAll(targets) {
  const results = Object.fromEntries(await Promise.all(targets.map(async (t) => [t.id, await check(t)])));
  const failed = targets.filter((t) => !results[t.id].ok);
  if (failed.length) {
    await new Promise((r) => setTimeout(r, RETRY_MS));
    for (const [id, res] of await Promise.all(failed.map(async (t) => [t.id, await check(t)]))) results[id] = res;
  }
  return results;
}

// ---------- the data document ----------

export const utcDay = (d) => d.toISOString().slice(0, 10);

/** An empty document, or a stored one brought up to today: one entry per day, newest last. */
export function normalize(data, targets, now) {
  const today = utcDay(now);
  data = data && data.v === 1 ? data : { v: 1, days: [], targets: {}, quota: { limit: config.limit, totals: [], byScript: {} } };
  data.quota ??= { limit: config.limit, totals: [], byScript: {} };
  data.quota.byScript ??= {};
  const last = data.days.at(-1);
  if (last !== today) {
    // Add every missing day up to today (a gap in the probe shows as days without data).
    const days = [];
    for (let d = last ? new Date(`${last}T00:00:00Z`) : new Date(`${today}T00:00:00Z`); utcDay(d) <= today; d = new Date(d.getTime() + 86_400_000)) {
      if (utcDay(d) !== last) days.push(utcDay(d));
    }
    data.days.push(...days);
    for (const t of Object.values(data.targets)) t.d.push(...days.map(() => null));
    data.quota.totals.push(...days.map(() => null));
  }
  const drop = Math.max(0, data.days.length - DAYS);
  if (drop) {
    data.days.splice(0, drop);
    for (const t of Object.values(data.targets)) t.d.splice(0, drop);
    data.quota.totals.splice(0, drop);
  }
  for (const t of targets) {
    data.targets[t.id] ??= { state: "unknown", since: now.toISOString(), d: data.days.map(() => null), r: [] };
    const d = data.targets[t.id].d;
    while (d.length < data.days.length) d.unshift(null);
  }
  // Targets removed from targets.json drop out of the document.
  for (const id of Object.keys(data.targets)) if (!targets.some((t) => t.id === id)) delete data.targets[id];
  return data;
}

/** Records one check; returns "down" / "up" when the state flipped (for incidents), else null. */
export function record(entry, res, now) {
  const day = entry.d.length - 1;
  const [ok, total, msSum] = entry.d[day] ?? [0, 0, 0];
  entry.d[day] = [ok + (res.ok ? 1 : 0), total + 1, msSum + (res.ok && res.ms != null ? res.ms : 0)];
  entry.r.push(res.ok ? res.ms : -1);
  if (entry.r.length > RECENT) entry.r.splice(0, entry.r.length - RECENT);
  Object.assign(entry, { code: res.code, ms: res.ms, reason: res.reason, checkedAt: now.toISOString() });
  const state = res.ok ? "up" : "down";
  if (entry.state === state) return null;
  const from = entry.state;
  entry.state = state;
  entry.since = now.toISOString();
  // From "unknown" (first run), only a "down" is news.
  return from === "unknown" && state === "up" ? null : state;
}

/** Whether today's account-wide Worker requests warrant a warning, and how bad. */
export function quotaLevel(total, limit, now) {
  const midnight = Date.parse(`${utcDay(now)}T00:00:00Z`);
  const elapsed = Math.max((now.getTime() - midnight) / 86_400_000, 1 / 24);
  const projected = Math.round(total / elapsed);
  const used = total / limit;
  let level = null;
  if (used >= WARN_AT) level = "high";
  else if (elapsed >= 2 / 24 && used >= 0.25 && projected >= limit) level = "pace";
  return { used, projected, level };
}

// ---------- Cloudflare usage ----------

/** Requests per Worker script for each UTC day since `from` (the free plan's limit is per account
 * per UTC day; static asset requests don't count, and aren't in this dataset either). */
async function cloudflareRequests(from, to) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  if (!account || !token) return null;
  const query = `query($a: String!, $from: Date!, $to: Date!) { viewer { accounts(filter: { accountTag: $a }) {
    workersInvocationsAdaptive(limit: 10000, filter: { date_geq: $from, date_leq: $to }) { sum { requests } dimensions { date scriptName } } } } }`;
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { a: account, from, to } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.errors?.length) throw new Error(`Cloudflare analytics: ${r.status} ${JSON.stringify(json.errors ?? "").slice(0, 300)}`);
  const rows = json.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
  const byDay = {};
  for (const row of rows) {
    const day = (byDay[row.dimensions.date] ??= {});
    day[row.dimensions.scriptName] = (day[row.dimensions.scriptName] ?? 0) + row.sum.requests;
  }
  return byDay;
}

// ---------- GitHub ----------

async function gh(path, { method = "GET", body } = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  const json = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(`GitHub ${method} ${path}: ${r.status} ${JSON.stringify(json)?.slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  return json;
}

const LABELS = {
  "status-data": ["0e8a16", "Data for the live status page (edited by live-status.yml)"],
  incident: ["d73a4a", "A production surface is down (opened and closed by live-status.yml)"],
  quota: ["fbca04", "Cloudflare Workers requests near the daily limit (live-status.yml)"],
};

async function ensureLabels() {
  for (const [name, [color, description]] of Object.entries(LABELS)) {
    try {
      await gh("/labels", { method: "POST", body: { name, color, description } });
    } catch (e) {
      if (e.status !== 422) throw e; // 422: it already exists
    }
  }
}

const DATA_START = "```json\n";
const DATA_END = "\n```";

function dataBody(data) {
  return [
    `<!-- heji-status-data v1 -->`,
    `The data behind the [live status page](${PAGE}): uptime and response times for every surface in`,
    "`scripts/status/targets.json`, and the Cloudflare account's daily Worker requests. Edited by",
    "`live-status.yml` every few minutes; please leave it open and unedited.",
    "",
    DATA_START + JSON.stringify(data) + DATA_END,
  ].join("\n");
}

export function parseData(body) {
  const start = body?.indexOf(DATA_START) ?? -1;
  if (start < 0) return null;
  const end = body.indexOf(DATA_END, start + DATA_START.length);
  try {
    return JSON.parse(body.slice(start + DATA_START.length, end));
  } catch {
    return null;
  }
}

async function loadDataIssue() {
  const [issue] = await gh(`/issues?labels=status-data&state=all&per_page=1&sort=created&direction=asc`);
  if (issue) return issue;
  const created = await gh("/issues", { method: "POST", body: { title: "Live status data", body: dataBody(null), labels: ["status-data"] } });
  await gh(`/issues/${created.number}/lock`, { method: "PUT", body: { lock_reason: "resolved" } }).catch(() => {});
  return created;
}

const fmtDuration = (ms) => {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : m < 2880 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.round(m / 1440)} days`;
};

async function openIncidents() {
  return gh(`/issues?labels=incident&state=open&per_page=100`);
}

async function onDown(t, entry, open) {
  if (open.some((i) => i.labels.some((l) => l.name === `status:${t.id}`))) return;
  try {
    await gh("/labels", { method: "POST", body: { name: `status:${t.id}`, color: "ededed", description: `Live status: ${t.name} — ${t.surface}` } });
  } catch (e) {
    if (e.status !== 422) throw e;
  }
  await gh("/issues", {
    method: "POST",
    body: {
      title: `${t.name} is down: ${t.surface}`,
      labels: ["incident", `status:${t.id}`],
      body: [
        `@${OWNER} **${t.name}** (${t.surface}) stopped answering at ${entry.since}.`,
        "",
        `- URL: ${t.url}`,
        `- What the probe saw: ${entry.reason}${entry.code ? ` (HTTP ${entry.code})` : ""}`,
        `- Served by: ${t.via}`,
        "",
        `Checked from GitHub Actions, outside Cloudflare, twice ${RETRY_MS / 1000} s apart. This issue closes itself when it answers again.`,
        `Live status: ${PAGE}`,
      ].join("\n"),
    },
  });
}

async function onUp(t, entry, open) {
  for (const issue of open.filter((i) => i.labels.some((l) => l.name === `status:${t.id}`))) {
    const down = Date.parse(entry.since) - Date.parse(issue.created_at);
    await gh(`/issues/${issue.number}/comments`, {
      method: "POST",
      body: { body: `Back up at ${entry.since} (HTTP ${entry.code}, ${entry.ms} ms), down for about ${fmtDuration(down)}.` },
    });
    await gh(`/issues/${issue.number}`, { method: "PATCH", body: { state: "closed", state_reason: "completed" } });
  }
}

async function syncQuotaIssue(data, now) {
  const q = data.quota;
  const today = utcDay(now);
  const total = q.totals.at(-1) ?? 0;
  const { used, projected, level } = quotaLevel(total, q.limit, now);
  const open = await gh(`/issues?labels=quota&state=open&per_page=20`);
  const title = `Cloudflare Workers at ${Math.round(used * 100)}% of the daily request limit (${today} UTC)`;
  const top = Object.entries(q.byScript)
    .map(([s, days]) => [s, days.at(-1) ?? 0])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s, n]) => `| \`${s}\` | ${n.toLocaleString("en-US")} |`);
  const body = [
    `@${OWNER} The Cloudflare account has served **${total.toLocaleString("en-US")}** Worker requests so far today (UTC), ` +
      `${Math.round(used * 100)}% of the ${q.limit.toLocaleString("en-US")} a day the free plan allows. At today's pace it reaches ` +
      `**${projected.toLocaleString("en-US")}**. When it runs out, every Worker answers with error 1027 until 00:00 UTC.`,
    "",
    "| Worker | Requests today |",
    "| --- | --- |",
    ...top,
    "",
    `Updated ${now.toISOString()} by live-status.yml. Live status: ${PAGE}`,
  ].join("\n");
  const mine = open.find((i) => i.title.endsWith(`(${today} UTC)`));
  for (const issue of open.filter((i) => i !== mine)) {
    await gh(`/issues/${issue.number}/comments`, { method: "POST", body: { body: "A new UTC day started; the daily request count reset." } });
    await gh(`/issues/${issue.number}`, { method: "PATCH", body: { state: "closed", state_reason: "completed" } });
  }
  if (mine) await gh(`/issues/${mine.number}`, { method: "PATCH", body: { title, body } });
  else if (level) await gh("/issues", { method: "POST", body: { title, body, labels: ["quota"] } });
}

// ---------- main ----------

async function main() {
  const dry = process.argv.includes("--dry-run");
  const now = new Date();
  const { targets } = config;
  const results = await checkAll(targets);

  if (dry) {
    for (const t of targets) {
      const r = results[t.id];
      console.log(`${r.ok ? "up  " : "DOWN"} ${String(r.code).padStart(3)} ${String(r.ms ?? "-").padStart(5)} ms  ${t.id}${r.reason ? `  ${r.reason}` : ""}`);
    }
    const usage = await cloudflareRequests(utcDay(now), utcDay(now)).catch((e) => console.log(e.message));
    if (usage) {
      const total = Object.values(usage[utcDay(now)] ?? {}).reduce((a, b) => a + b, 0);
      console.log(`Cloudflare: ${total} Worker requests today (UTC)`, quotaLevel(total, config.limit, now));
    } else console.log("Cloudflare: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_ANALYTICS_TOKEN not set");
    return;
  }

  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required (or pass --dry-run)");
  await ensureLabels();
  const issue = await loadDataIssue();
  const data = normalize(parseData(issue.body), targets, now);

  for (const t of targets) record(data.targets[t.id], results[t.id], now);

  // Cloudflare usage: today and yesterday (yesterday's last minutes land after midnight).
  const yesterday = utcDay(new Date(now.getTime() - 86_400_000));
  let quotaOk = false;
  try {
    const usage = await cloudflareRequests(yesterday, utcDay(now));
    if (usage) {
      const q = data.quota;
      for (const [offset, day] of [[2, yesterday], [1, utcDay(now)]]) {
        const i = data.days.length - offset;
        if (i < 0 || data.days[i] !== day) continue;
        const scripts = usage[day] ?? {};
        q.totals[i] = Object.values(scripts).reduce((a, b) => a + b, 0);
        for (const [s, n] of Object.entries(scripts)) {
          const arr = (q.byScript[s] ??= []);
          while (arr.length < data.days.length) arr.unshift(null);
          arr[i] = n;
        }
      }
      for (const arr of Object.values(q.byScript)) {
        while (arr.length < data.days.length) arr.unshift(null);
        if (arr.length > data.days.length) arr.splice(0, arr.length - data.days.length);
        arr.splice(0, Math.max(0, arr.length - QUOTA_DAYS));
      }
      q.updated = now.toISOString();
      delete q.error;
      quotaOk = true;
    }
  } catch (e) {
    data.quota.error = String(e.message ?? e).slice(0, 200);
    console.log(`::warning::${data.quota.error}`);
  }
  data.updated = now.toISOString();
  data.limit = config.limit;

  await gh(`/issues/${issue.number}`, { method: "PATCH", body: { body: dataBody(data) } });

  // Reconcile every run (not only on a flip), so a failed issue call fixes itself next time.
  const open = await openIncidents();
  for (const t of targets) {
    if (data.targets[t.id].state === "down") await onDown(t, data.targets[t.id], open);
    else await onUp(t, data.targets[t.id], open);
  }
  if (quotaOk) await syncQuotaIssue(data, now);

  const down = targets.filter((t) => data.targets[t.id].state === "down");
  console.log(`${targets.length - down.length}/${targets.length} up${down.length ? `; down: ${down.map((t) => t.id).join(", ")}` : ""}` +
    (quotaOk ? `; Cloudflare ${data.quota.totals.at(-1)} requests today` : ""));
  for (const t of down) console.log(`::warning title=${t.name} is down::${data.targets[t.id].reason}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
