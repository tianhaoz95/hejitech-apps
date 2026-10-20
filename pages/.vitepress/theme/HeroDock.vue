<script setup lang="ts">
// The home hero's app dock: one icon per app, magnified on hover, keys 1–8 and a click jump to the
// app's card. The lens toggle switches what the tooltips say: what the app does, or how it's built.
// The green dot means the app's TestFlight workflow last passed, as of the site build.
import { onMounted, onUnmounted, ref } from "vue";
import { withBase } from "vitepress";
import { APPS } from "./apps";
import { data } from "../../status.data";

type Lens = "user" | "builder";
const LENS_KEY = "heji-dock-lens";
// Server-rendered as "user"; the saved lens is applied after hydration so the HTML matches.
const lens = ref<Lens>("user");

const testflightPassing = (id: string) =>
  data.projects.find((p) => p.id === id)?.workflows.find((w) => w.file === `${id}-testflight.yml`)?.lastRun?.conclusion === "success";

function setLens(next: Lens) {
  lens.value = next;
  try {
    localStorage.setItem(LENS_KEY, next);
  } catch {}
}

function jump(id: string) {
  const card = document.getElementById(id);
  if (!card) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  history.replaceState(null, "", `#${id}`);
  if (reduce) return;
  card.classList.remove("heji-flash");
  void card.offsetWidth; // restart the animation on a repeat jump
  card.classList.add("heji-flash");
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
  const t = e.target as HTMLElement;
  if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
  const app = APPS[Number(e.key) - 1];
  if (!app) return;
  e.preventDefault();
  jump(app.id);
}

onMounted(() => {
  try {
    if (localStorage.getItem(LENS_KEY) === "builder") lens.value = "builder";
  } catch {}
  window.addEventListener("keydown", onKey);
});
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="heji-dock-row">
    <nav class="heji-dock" aria-label="Apps">
      <a
        v-for="(app, i) in APPS"
        :key="app.id"
        class="heji-dock-item no-icon"
        :href="`#${app.id}`"
        :aria-describedby="`heji-tip-${app.id}`"
        @click.prevent="jump(app.id)"
      >
        <img :src="withBase(app.icon)" alt="" width="44" height="44" />
        <span class="heji-dock-name">{{ app.name }}</span>
        <kbd class="heji-dock-key">{{ i + 1 }}</kbd>
        <span v-if="testflightPassing(app.id)" class="heji-dock-live" title="TestFlight build passing"></span>
        <span :id="`heji-tip-${app.id}`" class="heji-dock-tip" role="tooltip">
          <b>{{ app.name }}</b>
          <template v-if="lens === 'user'">
            <span class="heji-dock-tip-line">{{ app.tagline }}</span>
            <span class="heji-dock-tip-row"><i>On</i>{{ app.platforms.join(" · ") }}</span>
          </template>
          <template v-else>
            <span class="heji-dock-tip-row"><i>Backend</i>{{ app.backend }}</span>
            <span class="heji-dock-tip-row"><i>AI</i>{{ app.ai }}</span>
            <span class="heji-dock-tip-row"><i>Code</i><code>{{ app.code }}/</code></span>
          </template>
        </span>
      </a>
    </nav>
    <div class="heji-lens" role="group" aria-label="Show in tooltips">
      <button type="button" :aria-pressed="lens === 'user'" title="What each app does" @click="setLens('user')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
        <span>What it does</span>
      </button>
      <button type="button" :aria-pressed="lens === 'builder'" title="How each app is built" @click="setLens('builder')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" /></svg>
        <span>How it's built</span>
      </button>
    </div>
  </div>
</template>
