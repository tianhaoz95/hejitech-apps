<script setup lang="ts">
// A large way into the site search from the home hero. It opens VitePress's own local search box
// (no second search): the box listens for ⌘K, and reads its query from sessionStorage when it
// opens, so a suggestion chip arrives already typed.
import { openSearch } from "./search";

const SUGGESTIONS = ["offline maps", "baby log", "whisper", "cut_release", "graduation"];
</script>

<template>
  <div class="heji-hero-search">
    <button type="button" class="heji-hero-search-field" @click="openSearch()">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <span>Search apps and docs</span>
      <kbd>/</kbd>
    </button>
    <div class="heji-hero-search-chips">
      <button v-for="q in SUGGESTIONS" :key="q" type="button" @click="openSearch(q)">{{ q }}</button>
    </div>
  </div>
</template>
