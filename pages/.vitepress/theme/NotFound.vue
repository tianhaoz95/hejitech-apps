<script setup lang="ts">
// The 404 page (GitHub Pages serves dist/404.html with a 404 status for any missing path). Ranks
// every page of the site by edit distance to the missing path, offers the closest, opens search
// with the path's words, and lets the visitor report the broken link through FeedbackKit.
import { computed, onMounted, ref } from "vue";
import { useData, withBase } from "vitepress";
import { data as routes } from "../../routes.data";
import { APPS } from "./apps";
import { openSearch } from "./search";

const { site } = useData();
// The requested path is only known in the browser (404.html is built once for every path).
const path = ref("");

function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

// "Wee Hours · Decisions (v0)": a docs page's own title doesn't say which app it belongs to.
function label(url: string, title: string) {
  const app = APPS.find((a) => url.startsWith(`/${a.id}/`));
  if (!app) return title;
  return url === `/${app.id}/` ? app.name : `${app.name} · ${title}`;
}

const norm = (p: string) => p.toLowerCase().replace(/\.html$/, "").replace(/\/+$/, "");
const closest = computed(() =>
  path.value
    ? routes
        .map((r) => ({ ...r, title: label(r.url, r.title), d: distance(norm(path.value), norm(r.url)) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
    : [],
);
// Close enough to be a typo: a couple of edits, or a quarter of the path.
const best = computed(() => {
  const top = closest.value[0];
  return top && top.d <= Math.max(2, Math.floor(norm(path.value).length / 4)) ? top : null;
});
const words = computed(() => path.value.replace(/\.html$/, "").replace(/[/_\-.]+/g, " ").trim());

async function report() {
  const { FeedbackKit } = await import("feedbackkit-web");
  const from = document.referrer ? ` (from ${document.referrer})` : "";
  // The SDK has no prefilled message, so the broken path travels in the report's screen name.
  FeedbackKit.currentScreen = `Docs - 404 ${path.value}${from}`;
  await FeedbackKit.presentAndSubmit({ captureScreenshot: false });
}

onMounted(() => {
  const base = site.value.base;
  const p = decodeURIComponent(window.location.pathname);
  path.value = p.startsWith(base) ? `/${p.slice(base.length)}` : p;
});
</script>

<template>
  <div class="heji-404">
    <p class="heji-404-code">404</p>
    <h1>No page at this address</h1>
    <p v-if="path" class="heji-404-path"><code>{{ path }}</code></p>
    <a v-if="best" class="heji-404-go no-icon" :href="withBase(best.url)">Go to <b>{{ best.title }}</b> →</a>
    <div v-if="closest.length" class="heji-404-list">
      <p class="heji-404-h">Closest pages</p>
      <a v-for="r in closest" :key="r.url" class="no-icon" :class="{ best: r === best }" :href="withBase(r.url)">
        <span>{{ r.title }}</span><code>{{ r.url }}</code>
      </a>
    </div>
    <button v-if="words" type="button" class="heji-hero-search-field" @click="openSearch(words)">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <span>Search for “{{ words }}”</span>
      <kbd>↵</kbd>
    </button>
    <p class="heji-404-more">
      Followed a link here? <button type="button" @click="report">Tell us where you found it</button> ·
      <a :href="withBase('/')">Take me home</a>
    </p>
  </div>
</template>
