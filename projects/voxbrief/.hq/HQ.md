---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# voxbrief: HQ guidance

No backend. Releases refuse until the in-app What's New describes the version. Mac app finds updates by listing voxbrief-v releases.

How to build and test: `projects/voxbrief/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh voxbrief`).
