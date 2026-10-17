<script setup lang="ts">
// The production status page (pages/status.md). Badges come from GitHub and shields.io and need no
// API calls; the "Last run" column and Cloudflare's deploy checks come from the GitHub REST API in
// the browser (unauthenticated: 60 requests an hour per visitor, so results are cached for a minute).
import { computed, onMounted, ref } from "vue";
import { data, type Workflow } from "../../status.data";

const REPO = "tianhaoz95/hejitech-apps";

interface Run {
  path: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string;
  html_url: string;
  updated_at: string;
  run_started_at: string;
}
interface Release {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
}
interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  completed_at: string | null;
  started_at: string;
  app: { slug: string; name: string } | null;
}

const gh = `https://github.com/${REPO}`;
const kindLabel: Record<Workflow["kind"], string> = { ci: "CI", deploy: "Deploy", release: "Release", automation: "Automation" };

const runs = ref<Record<string, Run>>({});
const checks = ref<CheckRun[]>([]);
const releases = ref<Record<string, Release>>({});
const liveError = ref<string | null>(null);
const loadedAt = ref<Date | null>(null);
const loading = ref(false);
const filter = ref<"all" | "failing">("all");

const badge = (w: Workflow) =>
  `${gh}/actions/workflows/${w.file}/badge.svg${w.kind === "ci" || w.kind === "deploy" ? "?branch=main" : ""}`;
const releaseBadge = (prefix: string, name: string) =>
  `https://img.shields.io/github/v/release/${REPO}?filter=${encodeURIComponent(prefix + "*")}&label=${encodeURIComponent(name)}&color=2f5bea`;
const releasesLink = (prefix: string) => `${gh}/releases?q=${encodeURIComponent(prefix)}&expanded=true`;
const websiteBadge = (url: string) =>
  `https://img.shields.io/website?url=${encodeURIComponent(url)}&label=${encodeURIComponent("up")}&up_message=online&down_message=down`;

function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

function state(r: { status: string; conclusion: string | null } | undefined): string {
  if (!r) return "none";
  if (r.status !== "completed") return "running";
  return r.conclusion ?? "none";
}
const stateLabel: Record<string, string> = {
  success: "passed", failure: "failed", cancelled: "cancelled", skipped: "skipped", running: "running",
  timed_out: "timed out", action_required: "needs action", startup_failure: "startup failure", neutral: "neutral", none: "",
};
const isBad = (s: string) => ["failure", "timed_out", "startup_failure", "action_required"].includes(s);

const failing = computed(() => Object.values(runs.value).filter((r) => isBad(state(r))).length);
const visibleProjects = computed(() =>
  data.projects
    .map((p) => ({
      ...p,
      workflows: filter.value === "all" ? p.workflows : p.workflows.filter((w) => isBad(state(runs.value[w.file]))),
    }))
    .filter((p) => p.workflows.length || (filter.value === "all" && p.tagPrefix)),
);
const releaseProjects = computed(() => data.projects.filter((p) => p.tagPrefix));
const deployChecks = computed(() => checks.value.filter((c) => /cloudflare/i.test(`${c.app?.slug ?? ""} ${c.name}`)));

const CACHE_KEY = "heji-status-v2";
async function load(force = false) {
  loading.value = true;
  liveError.value = null;
  try {
    let cached: { at: number; runs: Run[]; checks: CheckRun[]; releases: Release[] } | null = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
    } catch { /* storage unavailable */ }
    if (!force && cached && Date.now() - cached.at < 60_000) {
      apply(cached.runs, cached.checks, cached.releases, new Date(cached.at));
      return;
    }
    const api = `https://api.github.com/repos/${REPO}`;
    const headers = { Accept: "application/vnd.github+json" };
    const [r1, r2, r3] = await Promise.all([
      fetch(`${api}/actions/runs?per_page=100`, { headers }),
      fetch(`${api}/commits/main/check-runs?per_page=100`, { headers }),
      fetch(`${api}/releases?per_page=100`, { headers }),
    ]);
    if (r1.status === 403 || r1.status === 429) throw new Error("GitHub's API rate limit for this network is used up; badges still show the latest state.");
    if (!r1.ok) throw new Error(`GitHub API: ${r1.status}`);
    const runList = ((await r1.json()).workflow_runs ?? []) as Run[];
    const checkList = r2.ok ? (((await r2.json()).check_runs ?? []) as CheckRun[]) : [];
    const releaseList = r3.ok ? ((await r3.json()) as Release[]) : [];
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), runs: runList, checks: checkList, releases: releaseList }));
    } catch { /* storage unavailable */ }
    apply(runList, checkList, releaseList, new Date());
  } catch (e) {
    liveError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function apply(runList: Run[], checkList: CheckRun[], releaseList: Release[], at: Date) {
  const latest: Record<string, Run> = {};
  // Newest first from the API: keep the first run seen per workflow file.
  for (const r of runList) {
    const file = r.path.split("/").pop()!.split("@")[0];
    latest[file] ??= r;
  }
  runs.value = latest;
  checks.value = checkList;
  // Newest first: the first published, non-prerelease release per project's tag prefix.
  const byPrefix: Record<string, Release> = {};
  for (const r of releaseList) {
    if (r.draft || r.prerelease) continue;
    const p = releaseProjects.value.find((p) => r.tag_name.startsWith(p.tagPrefix!));
    if (p) byPrefix[p.id] ??= r;
  }
  releases.value = byPrefix;
  loadedAt.value = at;
}

onMounted(() => void load());
</script>

<template>
  <div class="heji-status">
    <div class="heji-status-bar">
      <span v-if="loadedAt" class="heji-status-summary" :class="{ bad: failing > 0 }">
        <template v-if="failing">{{ failing }} workflow{{ failing === 1 ? "" : "s" }} failing on the latest run</template>
        <template v-else>All latest runs green</template>
      </span>
      <span v-else-if="loading" class="heji-status-summary">Loading latest runs…</span>
      <span class="heji-status-actions">
        <button class="heji-btn" :class="{ brand: filter === 'all' }" @click="filter = 'all'">All</button>
        <button class="heji-btn" :class="{ brand: filter === 'failing' }" @click="filter = 'failing'">Failing</button>
        <button class="heji-btn" :disabled="loading" @click="load(true)">{{ loading ? "Refreshing…" : "Refresh" }}</button>
        <a class="heji-btn no-icon" :href="`${gh}/actions`" target="_blank" rel="noopener">All runs ↗</a>
      </span>
    </div>
    <p v-if="liveError" class="heji-status-note">{{ liveError }}</p>
    <p v-else-if="loadedAt" class="heji-status-note">Live data from GitHub, {{ ago(loadedAt.toISOString()) }}.</p>

    <h2 id="deployments">Production deployments</h2>
    <div class="heji-status-table">
      <table>
        <thead><tr><th>Surface</th><th>Health</th><th>Deploys via</th></tr></thead>
        <tbody>
          <tr v-for="d in data.deployments" :key="d.url">
            <td><a :href="d.url" target="_blank" rel="noopener">{{ d.name }}</a></td>
            <td>
              <img v-if="d.health !== false" :src="websiteBadge(d.url)" :alt="`${d.name} health`" loading="lazy">
              <span v-else class="heji-status-when">API endpoint</span>
            </td>
            <td>
              <a v-if="d.workflow" :href="`${gh}/actions/workflows/${d.workflow}`" target="_blank" rel="noopener">
                <img :src="`${gh}/actions/workflows/${d.workflow}/badge.svg?branch=main`" :alt="d.via" loading="lazy">
              </a>
              <span v-else>{{ d.via }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template v-if="deployChecks.length">
      <h3>Cloudflare builds on the latest <code>main</code> commit</h3>
      <div class="heji-status-table">
        <table>
          <thead><tr><th>Check</th><th>Result</th><th>When</th></tr></thead>
          <tbody>
            <tr v-for="c in deployChecks" :key="c.name">
              <td><a :href="c.html_url" target="_blank" rel="noopener">{{ c.name }}</a></td>
              <td><span class="heji-pill" :class="state(c)">{{ stateLabel[state(c)] || state(c) }}</span></td>
              <td>{{ ago(c.completed_at ?? c.started_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <h2 id="releases">Latest releases</h2>
    <div v-if="loadedAt && Object.keys(releases).length" class="heji-status-table">
      <table>
        <thead><tr><th>App</th><th>Latest</th><th>Published</th><th>Release pipelines</th></tr></thead>
        <tbody>
          <tr v-for="p in releaseProjects" :key="p.id">
            <td><a :href="releasesLink(p.tagPrefix!)" target="_blank" rel="noopener">{{ p.name }}</a></td>
            <td>
              <a v-if="releases[p.id]" :href="releases[p.id].html_url" target="_blank" rel="noopener" class="heji-pill success">
                {{ releases[p.id].tag_name.slice(p.tagPrefix!.length - 1) }}
              </a>
              <span v-else class="heji-status-when">not in the last 100 releases</span>
            </td>
            <td>{{ releases[p.id] ? ago(releases[p.id].published_at) : "" }}</td>
            <td class="heji-status-badges">
              <img v-for="w in p.workflows.filter((w) => w.kind === 'release')" :key="w.file" :src="badge(w)" :alt="`${w.name} status`" :title="w.name" loading="lazy">
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Without the API (rate limit), shields' badges: they only see recent releases, hence the API first. -->
    <div v-else class="heji-status-releases">
      <a v-for="p in releaseProjects" :key="p.id" :href="releasesLink(p.tagPrefix!)" target="_blank" rel="noopener" class="no-icon">
        <img :src="releaseBadge(p.tagPrefix!, p.name)" :alt="`${p.name} latest release`" loading="lazy">
      </a>
    </div>

    <h2 id="workflows">Workflows</h2>
    <p v-if="filter === 'failing' && !visibleProjects.length" class="heji-status-note">Nothing is failing.</p>
    <section v-for="p in visibleProjects" :key="p.id">
      <h3 :id="`wf-${p.id}`">{{ p.name }}</h3>
      <div v-if="p.workflows.length" class="heji-status-table">
        <table>
          <thead><tr><th>Workflow</th><th>Kind</th><th>Status</th><th>Last run</th></tr></thead>
          <tbody>
            <tr v-for="w in p.workflows" :key="w.file">
              <td><a :href="`${gh}/actions/workflows/${w.file}`" target="_blank" rel="noopener">{{ w.name }}</a></td>
              <td><span class="heji-kind" :class="w.kind">{{ kindLabel[w.kind] }}</span></td>
              <td><img :src="badge(w)" :alt="`${w.name} status`" loading="lazy"></td>
              <td>
                <template v-if="runs[w.file]">
                  <a :href="runs[w.file].html_url" target="_blank" rel="noopener" class="heji-pill" :class="state(runs[w.file])">
                    {{ stateLabel[state(runs[w.file])] || state(runs[w.file]) }}
                  </a>
                  <span class="heji-status-when">{{ ago(runs[w.file].run_started_at ?? runs[w.file].updated_at) }} · {{ runs[w.file].event }}</span>
                </template>
                <span v-else-if="loadedAt" class="heji-status-when">not in the last 100 runs</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
