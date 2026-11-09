---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# toddlercam: HQ guidance

iPhone app with watch app and complications; no backend.

How to build and test: `projects/toddlercam/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh toddlercam`).
