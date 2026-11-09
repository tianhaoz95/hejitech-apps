---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# waypack: HQ guidance

Trip planner, local-first. Its Mac app updates from the repo's `releases/latest`; only Waypack may mark releases latest. Offline reliability beats new features.

How to build and test: `projects/waypack/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh waypack`).
