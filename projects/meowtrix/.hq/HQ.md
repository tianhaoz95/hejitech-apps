---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# meowtrix: HQ guidance

Standalone npm project; sessions inherit MEOWTRIX_DATA_DIR, so run its servers and tests through its clean_env.sh.

How to build and test: `projects/meowtrix/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh meowtrix`).
