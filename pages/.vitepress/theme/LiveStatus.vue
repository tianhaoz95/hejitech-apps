<script setup lang="ts">
// The live status page (pages/live.md). Every few minutes live-status.yml checks each surface from
// GitHub Actions, outside Cloudflare, and stores the results as JSON in the locked `status-data`
// issue; outages are `incident` issues and Cloudflare request warnings `quota` issues. This page
// reads those three from the GitHub API in the browser (unauthenticated, cached for a minute, so it
// stays well inside the 60 requests an hour GitHub allows a visitor). Nothing here touches
// Cloudflare, so it keeps working when the Workers don't.
import { computed, onMounted, onUnmounted, ref } from "vue";
import { data as config, type LiveTarget } from "../../live.data";

const REPO = "tianhaoz95/hejitech-apps";
const gh = `https://github.com/${REPO}`;
const STALE_MIN = 20;

interface Entry {
  state: "up" | "down" | "unknown";
  since: string;
  code?: number;
  ms?: number | null;
  reason?: string | null;
  checkedAt?: string;
  /** Per day, aligned with `days`: [ok checks, all checks, sum of ok response times] or null. */
  d: ([number, number, number] | null)[];
  /** The last few response times in ms, -1 for a failed check. */
  r: number[];
}
interface Doc {
  v: 1;
  updated: string;
  days: string[];
  targets: Record<string, Entry>;
  quota: { limit: number; totals: (number | null)[]; byScript: Record<string, (number | null)[]>; updated?: string; error?: string };
}
interface Issue {
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  created_at: string;
  closed_at: string | null;
  labels: { name: string }[];
}

const doc = ref<Doc | null>(null);
const incidents = ref<Issue[]>([]);
const quotaIssues = ref<Issue[]>([]);
const dataIssue = ref<string | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const now = ref(Date.now());

function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = Math.max(0, (now.value - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  if (m < 2880) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return `${Math.round(m / 1440)} days`;
}
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const n = (x: number) => x.toLocaleString("en-US");
const pct = (x: number) => (x >= 0.9995 ? "100%" : `${(Math.floor(x * 1000) / 10).toFixed(1)}%`);

const CACHE_KEY = "heji-live-v1";
async function load(force = false) {
  loading.value = true;
  error.value = null;
  now.value = Date.now();
  try {
    let cached: { at: number; data: Issue[]; inc: Issue[]; quota: Issue[] } | null = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
    } catch { /* storage unavailable */ }
    let data: Issue[], inc: Issue[], quota: Issue[];
    if (!force && cached && Date.now() - cached.at < 60_000) ({ data, inc, quota } = cached);
    else {
      const api = `https://api.github.com/repos/${REPO}/issues`;
      const headers = { Accept: "application/vnd.github+json" };
      const [r1, r2, r3] = await Promise.all([
        fetch(`${api}?labels=status-data&state=all&per_page=1&sort=created&direction=asc`, { headers }),
        fetch(`${api}?labels=incident&state=all&per_page=30`, { headers }),
        fetch(`${api}?labels=quota&state=all&per_page=10`, { headers }),
      ]);
      if (r1.status === 403 || r1.status === 429) throw new Error("GitHub's API rate limit for this network is used up for the hour.");
      if (!r1.ok) throw new Error(`GitHub API: ${r1.status}`);
      data = await r1.json();
      inc = r2.ok ? await r2.json() : [];
      quota = r3.ok ? await r3.json() : [];
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data, inc, quota }));
      } catch { /* storage unavailable */ }
    }
    const issue = data[0] as (Issue & { body?: string }) | undefined;
    if (!issue) throw new Error("The probe hasn't reported yet.");
    dataIssue.value = issue.html_url;
    const body = issue.body ?? "";
    const start = body.indexOf("```json\n");
    if (start < 0) throw new Error("The probe hasn't reported yet.");
    doc.value = JSON.parse(body.slice(start + 8, body.indexOf("\n```", start + 8)));
    incidents.value = inc;
    quotaIssues.value = quota;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void load();
  timer = setInterval(() => {
    now.value = Date.now();
    if (document.visibilityState === "visible") void load();
  }, 5 * 60_000);
});
onUnmounted(() => clearInterval(timer));

// ---------- products ----------

const entry = (t: LiveTarget): Entry | undefined => doc.value?.targets[t.id];
const stale = computed(() => !!doc.value && now.value - new Date(doc.value.updated).getTime() > STALE_MIN * 60_000);
const down = computed(() => config.targets.filter((t) => entry(t)?.state === "down"));
const summary = computed(() => {
  if (!doc.value) return null;
  if (down.value.length === 0) return { bad: false, text: "All products operational" };
  if (down.value.length === 1) return { bad: true, text: `${down.value[0].name} is down` };
  return { bad: true, text: `${down.value.length} products are down` };
});

interface Cell { day: string; cls: string; tip: string }
function cells(t: LiveTarget): Cell[] {
  const e = entry(t);
  if (!doc.value || !e) return [];
  return doc.value.days.map((day, i) => {
    const d = e.d[i];
    if (!d || !d[1]) return { day, cls: "none", tip: `${day}: no data` };
    const ratio = d[0] / d[1];
    const avg = d[0] ? Math.round(d[2] / d[0]) : null;
    const cls = ratio === 1 ? "up" : ratio >= 0.98 ? "minor" : "major";
    return { day, cls, tip: `${day}: ${pct(ratio)} up (${d[0]}/${d[1]} checks)${avg != null ? `, ${avg} ms average` : ""}` };
  });
}
function uptime(t: LiveTarget, last?: number): number | null {
  const e = entry(t);
  if (!e) return null;
  const days = last ? e.d.slice(-last) : e.d;
  let ok = 0, all = 0;
  for (const d of days) if (d) { ok += d[0]; all += d[1]; }
  return all ? ok / all : null;
}
function spark(t: LiveTarget): { line: string; fails: number[]; max: number } | null {
  const r = entry(t)?.r ?? [];
  if (r.length < 2) return null;
  const okMs = r.filter((x) => x >= 0);
  const max = Math.max(200, ...okMs);
  const w = 100 / (r.length - 1);
  const pts: string[] = [];
  const fails: number[] = [];
  r.forEach((x, i) => {
    if (x < 0) fails.push(i * w);
    else pts.push(`${(i * w).toFixed(1)},${(22 - (x / max) * 20).toFixed(1)}`);
  });
  return { line: pts.join(" "), fails, max };
}

// ---------- Cloudflare usage ----------

const quota = computed(() => {
  const q = doc.value?.quota;
  if (!q || !q.updated) return null;
  const today = q.totals.at(-1) ?? 0;
  const midnight = Date.parse(`${doc.value!.days.at(-1)}T00:00:00Z`);
  const at = Date.parse(q.updated);
  const elapsed = Math.max((at - midnight) / 86_400_000, 1 / 24);
  const reset = midnight + 86_400_000;
  const scripts = Object.entries(q.byScript)
    .map(([name, days]) => ({ name, today: days.at(-1) ?? 0, yesterday: days.at(-2) ?? 0 }))
    .filter((s) => s.today || s.yesterday)
    .sort((a, b) => b.today - a.today);
  const last = q.totals.slice(-30).map((v, i, arr) => ({ v: v ?? 0, day: doc.value!.days[doc.value!.days.length - arr.length + i] }));
  const peak = Math.max(1, ...last.map((x) => x.v));
  return {
    limit: q.limit,
    today,
    used: today / q.limit,
    projected: Math.round(today / elapsed),
    reset,
    scripts,
    last,
    peak,
    updated: q.updated,
    error: q.error,
  };
});

// ---------- incidents ----------

const allIssues = computed(() =>
  [...incidents.value, ...quotaIssues.value].sort((a, b) => (a.state === b.state ? b.created_at.localeCompare(a.created_at) : a.state === "open" ? -1 : 1)),
);
const isQuota = (i: Issue) => i.labels.some((l) => l.name === "quota");
</script>

<template>
  <div class="heji-status heji-live">
    <div class="heji-status-bar">
      <span v-if="summary" class="heji-live-summary" :class="{ bad: summary.bad, stale }">
        <span class="heji-live-dot" />{{ summary.text }}
      </span>
      <span v-else-if="loading" class="heji-status-summary">Loading…</span>
      <span class="heji-status-actions">
        <button class="heji-btn" :disabled="loading" @click="load(true)">{{ loading ? "Refreshing…" : "Refresh" }}</button>
        <a class="heji-btn no-icon" :href="`${gh}/issues?q=label%3Aincident`" target="_blank" rel="noopener">Incident history ↗</a>
      </span>
    </div>
    <p v-if="error" class="heji-status-note">
      {{ error }} <a v-if="dataIssue" :href="dataIssue" target="_blank" rel="noopener">The raw data</a>
    </p>
    <p v-else-if="doc" class="heji-status-note">
      Checked {{ ago(doc.updated) }} from GitHub Actions, outside Cloudflare, every 5 minutes.
      <strong v-if="stale"> The probe hasn't reported for over {{ STALE_MIN }} minutes, so this may be out of date.</strong>
    </p>

    <template v-if="doc">
      <div v-if="down.length" class="heji-live-alerts">
        <div v-for="t in down" :key="t.id" class="heji-live-alert">
          <strong>{{ t.name }}</strong> ({{ t.surface }}) has been down since {{ when(entry(t)!.since) }}
          · {{ duration(now - new Date(entry(t)!.since).getTime()) }}. {{ entry(t)!.reason }}
        </div>
      </div>

      <h2 id="products">Products</h2>
      <div class="heji-live-list">
        <div v-for="t in config.targets" :key="t.id" class="heji-live-row">
          <div class="heji-live-head">
            <div class="heji-live-name">
              <a :href="t.url" target="_blank" rel="noopener">{{ t.name }}</a>
              <span class="heji-live-surface">{{ t.surface }}</span>
            </div>
            <div class="heji-live-now">
              <svg v-if="spark(t)" class="heji-live-spark" viewBox="0 0 100 24" preserveAspectRatio="none" :aria-label="`Response times, last ${entry(t)!.r.length} checks`">
                <polyline :points="spark(t)!.line" fill="none" vector-effect="non-scaling-stroke" />
                <rect v-for="x in spark(t)!.fails" :key="x" :x="x - 1" y="0" width="2" height="24" class="fail" />
              </svg>
              <span v-if="entry(t)?.state === 'up'" class="heji-live-ms">{{ entry(t)!.ms }} ms</span>
              <span class="heji-pill" :class="entry(t)?.state === 'up' ? 'success' : entry(t)?.state === 'down' ? 'failure' : 'none'">
                {{ entry(t)?.state === "up" ? "up" : entry(t)?.state === "down" ? "down" : "no data" }}
              </span>
            </div>
          </div>
          <div class="heji-live-bars" role="img" :aria-label="`${t.name}: ${uptime(t) != null ? pct(uptime(t)!) : 'no'} uptime over ${doc.days.length} days`">
            <span v-for="c in cells(t)" :key="c.day" :class="c.cls" :title="c.tip" />
          </div>
          <div class="heji-live-foot">
            <span>{{ doc.days.length }} day{{ doc.days.length === 1 ? "" : "s" }} ago</span>
            <span v-if="uptime(t) != null">{{ pct(uptime(t)!) }} uptime<template v-if="doc.days.length > 7"> · {{ pct(uptime(t, 7) ?? 1) }} last 7 days</template></span>
            <span>today</span>
          </div>
        </div>
      </div>

      <h2 id="cloudflare">Cloudflare request budget</h2>
      <template v-if="quota">
        <p class="heji-status-note">
          The Workers share one Cloudflare account, which serves up to {{ n(quota.limit) }} Worker requests a day (UTC).
          When that runs out, every Worker answers with error 1027 until the reset, so a runaway loop in one product takes down all of them.
          A <a :href="`${gh}/issues?q=label%3Aquota`" target="_blank" rel="noopener">warning issue</a> opens at 70%, or earlier when the day's pace would pass the limit.
        </p>
        <div class="heji-live-quota">
          <div class="heji-live-quota-nums">
            <span><strong>{{ n(quota.today) }}</strong> requests today ({{ pct(quota.used) }})</span>
            <span>on pace for {{ n(quota.projected) }}</span>
            <span>resets {{ when(new Date(quota.reset).toISOString()) }}</span>
          </div>
          <div class="heji-live-meter" :class="{ warn: quota.used >= 0.7 || quota.projected >= quota.limit }">
            <span class="fill" :style="{ width: `${Math.min(100, quota.used * 100)}%` }" />
            <span class="pace" :style="{ left: `${Math.min(100, (quota.projected / quota.limit) * 100)}%` }" title="Today's pace" />
            <span class="tick" style="left: 70%" title="Warning at 70%" />
          </div>
          <div class="heji-live-days" :aria-label="`Daily Worker requests, last ${quota.last.length} days`" role="img">
            <span v-for="d in quota.last" :key="d.day" :title="`${d.day}: ${n(d.v)} requests`" :style="{ height: `${Math.max(2, (d.v / quota.peak) * 100)}%` }" />
          </div>
          <div class="heji-live-foot"><span>{{ quota.last.length }} day{{ quota.last.length === 1 ? "" : "s" }} ago</span><span>busiest: {{ n(quota.peak) }} ({{ pct(quota.peak / quota.limit) }} of the limit)</span><span>today</span></div>
        </div>
        <div v-if="quota.scripts.length" class="heji-status-table">
          <table>
            <thead><tr><th>Worker</th><th>Today</th><th>Yesterday</th><th>Share today</th></tr></thead>
            <tbody>
              <tr v-for="s in quota.scripts" :key="s.name">
                <td><code>{{ s.name }}</code></td>
                <td>{{ n(s.today) }}</td>
                <td>{{ n(s.yesterday) }}</td>
                <td>{{ quota.today ? pct(s.today / quota.today) : "" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="quota.error" class="heji-status-note">Last Cloudflare read failed: {{ quota.error }}</p>
      </template>
      <p v-else class="heji-status-note">The probe isn't reading Cloudflare's usage yet (it needs the CLOUDFLARE_ANALYTICS_TOKEN secret).</p>

      <h2 id="incidents">Incidents</h2>
      <p v-if="!allIssues.length" class="heji-status-note">No incidents recorded yet.</p>
      <ul v-else class="heji-live-incidents">
        <li v-for="i in allIssues" :key="i.number">
          <span class="heji-pill" :class="i.state === 'open' ? 'failure' : 'success'">{{ i.state === "open" ? (isQuota(i) ? "warning" : "ongoing") : "resolved" }}</span>
          <a :href="i.html_url" target="_blank" rel="noopener">{{ i.title }}</a>
          <span class="heji-status-when">
            {{ when(i.created_at) }}
            <template v-if="i.closed_at"> · {{ duration(new Date(i.closed_at).getTime() - new Date(i.created_at).getTime()) }}</template>
            <template v-else> · {{ duration(now - new Date(i.created_at).getTime()) }} so far</template>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>
