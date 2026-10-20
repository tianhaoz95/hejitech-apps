<script setup lang="ts">
// The home hero's app dock: one icon per app, magnified around the pointer like the macOS Dock;
// a click or keys 1–8 jump to the app's card. The label above an icon follows the page's lens
// (lens.ts). The dot under an icon means the app's TestFlight workflow last passed, as of the build.
import { onMounted, onUnmounted, ref } from "vue";
import { withBase } from "vitepress";
import { APPS } from "./apps";
import { useLens } from "./lens";
import { data } from "../../status.data";

const { lens } = useLens();
const ICON = 48;
const dock = ref<HTMLElement>();
const scales = ref<number[]>(APPS.map(() => 1));
let centers: number[] = [];

const testflightPassing = (id: string) =>
  data.projects.find((p) => p.id === id)?.workflows.find((w) => w.file === `${id}-testflight.yml`)?.lastRun?.conclusion === "success";

const magnifies = () => matchMedia("(hover: hover) and (min-width: 641px) and (prefers-reduced-motion: no-preference)").matches;

// Centers are measured once per entry, at rest, so growing icons don't move the targets.
function enter() {
  if (!magnifies() || !dock.value) return;
  centers = [...dock.value.querySelectorAll<HTMLElement>(".heji-dock-item")].map((el) => {
    const r = el.getBoundingClientRect();
    return r.left + r.width / 2;
  });
}

function move(e: PointerEvent) {
  if (!centers.length) return;
  scales.value = centers.map((c) => 1 + 0.45 * Math.exp(-((e.clientX - c) ** 2) / (2 * 55 ** 2)));
}

function leave() {
  centers = [];
  scales.value = APPS.map(() => 1);
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

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <nav ref="dock" class="heji-dock" aria-label="Apps" @pointerenter="enter" @pointermove="move" @pointerleave="leave">
    <a
      v-for="(app, i) in APPS"
      :key="app.id"
      class="heji-dock-item no-icon"
      :href="`#${app.id}`"
      :style="{ '--s': scales[i] }"
      :aria-label="`${app.name}: ${app.tagline}`"
      @click.prevent="jump(app.id)"
    >
      <img :src="withBase(app.icon)" alt="" :width="ICON" :height="ICON" />
      <span class="heji-dock-name">{{ app.name }}</span>
      <span class="heji-dock-dot" :class="{ on: testflightPassing(app.id) }"></span>
      <span class="heji-dock-label" aria-hidden="true">
        <b>{{ app.name }}</b><kbd>{{ i + 1 }}</kbd>
        <small>{{ lens === "user" ? app.tagline : app.backend }}</small>
        <small v-if="testflightPassing(app.id)" class="ok">TestFlight build passing</small>
      </span>
    </a>
  </nav>
</template>
