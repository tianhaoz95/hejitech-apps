---
title: Live status
description: Are the HEJI apps up right now? Uptime for every product, checked every 5 minutes from outside Cloudflare, plus incidents and the Cloudflare request budget.
aside: false
pageClass: heji-status-page
---

<script setup>
import LiveStatus from "./.vitepress/theme/LiveStatus.vue";
</script>

# Live status

Whether every HEJI product is answering right now, and how it has done over the last 90 days.
The checks run every 5 minutes on GitHub Actions and this page is served by GitHub Pages, so
both keep working when Cloudflare, where the products run, is down. Outages become
[incident issues](https://github.com/tianhaoz95/hejitech-apps/issues?q=label%3Aincident) that
close themselves on recovery. Builds, releases and workflows: [CI status](./status).

<LiveStatus />
