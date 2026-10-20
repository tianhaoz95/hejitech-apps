<script setup lang="ts">
// The home page's app cards, with the lens switch: "What they do" shows platforms and a link to the
// app, "How they're built" shows backend, on-device AI and the code in the monorepo.
import { withBase } from "vitepress";
import { APPS, REPO } from "./apps";
import { useLens } from "./lens";

const { lens, setLens } = useLens();
const href = (url: string) => (url.startsWith("/") ? withBase(url) : url);
</script>

<template>
  <div class="heji-lens" role="group" aria-label="Show">
    <button type="button" :aria-pressed="lens === 'user'" @click="setLens('user')">What they do</button>
    <button type="button" :aria-pressed="lens === 'builder'" @click="setLens('builder')">How they're built</button>
  </div>
  <div class="heji-apps" :class="`lens-${lens}`">
    <div v-for="app in APPS" :id="app.id" :key="app.id" class="heji-app">
      <img :src="withBase(app.icon)" alt="" width="64" height="64" />
      <div class="heji-app-body">
        <h3><a class="no-icon" :href="href(app.docs)" target="_self">{{ app.name }}</a></h3>
        <p>{{ app.tagline }} {{ app.desc }}</p>
        <span v-if="lens === 'user'" class="heji-tags">
          <span v-for="p in app.platforms" :key="p">{{ p }}</span>
        </span>
        <dl v-else class="heji-stack">
          <dt>Backend</dt><dd>{{ app.backend }}</dd>
          <dt>AI</dt><dd>{{ app.ai }}</dd>
          <dt>Code</dt><dd><code>projects/{{ app.id }}/</code></dd>
        </dl>
        <span class="heji-links">
          <template v-if="lens === 'user'">
            <a v-if="app.appUrl" class="heji-btn brand no-icon" target="_blank" rel="noopener" :href="app.appUrl">Visit app</a>
            <a class="heji-btn no-icon" target="_blank" rel="noopener" :href="href(app.docs)">Docs →</a>
          </template>
          <template v-else>
            <a class="heji-btn brand no-icon" target="_blank" rel="noopener" :href="href(app.docs)">Docs →</a>
            <a class="heji-btn no-icon" target="_blank" rel="noopener" :href="`${REPO}/tree/main/projects/${app.id}`">Code ↗</a>
          </template>
        </span>
      </div>
    </div>
  </div>
</template>
