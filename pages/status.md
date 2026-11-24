---
title: CI status
description: Production status for every HEJI app — CI, releases and deployments from the monorepo in one place.
aside: false
pageClass: heji-status-page
---

<script setup>
import StatusBoard from "./.vitepress/theme/StatusBoard.vue";
</script>

# CI status

Every GitHub Actions workflow, release line and production deployment in the
[monorepo](./monorepo), on one page. The list is built from the repo itself
(`.github/workflows/` and each project's `release.env`), so new workflows show up on their own. Whether the products are up right now, with history and
incidents: [Live status](./live).

<StatusBoard />
