---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# polymath: HQ guidance

Tauri desktop app (signed, notarized DMGs) + Worker.

How to build and test: `projects/polymath/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh polymath`).
