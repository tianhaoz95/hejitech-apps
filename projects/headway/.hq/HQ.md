---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# headway: HQ guidance

Transit ETAs: iPhone, Watch, glasses plugin, Worker with an every-minute cron. The cron and realtime data are the product: protect them.

How to build and test: `projects/headway/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh headway`).
