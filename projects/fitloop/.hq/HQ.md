---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# fitloop: HQ guidance

Fitness logging: iPhone, Watch, glasses plugin, Worker.

How to build and test: `projects/fitloop/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh fitloop`).
