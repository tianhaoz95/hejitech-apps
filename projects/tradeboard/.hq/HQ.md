---
hq: 1
tier_ceiling: L1
never: [live-orders]
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# tradeboard: HQ guidance

Real-money trading plan board. Reliability and correctness beat features. Any change near order placement or the executor is L2 at minimum, even a refactor. The owner uses the portal daily; don't break the minute cron. Never place a live order.

How to build and test: `projects/tradeboard/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh tradeboard`).
