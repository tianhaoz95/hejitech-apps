---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# tinytouch: HQ guidance

Toddler-safe app. Versioned in the pbxproj written by tools/generate_project.py; never claim it blocks emergency features.

How to build and test: `projects/tinytouch/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh tinytouch`).
