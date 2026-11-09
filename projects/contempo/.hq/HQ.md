---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# contempo: HQ guidance

Android ships through the Play Console by hand; don't propose Android release automation as L1.

How to build and test: `projects/contempo/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh contempo`).
