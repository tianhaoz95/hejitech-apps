---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# g2digest: HQ guidance

Even G2 glasses plugin + Worker. Even Hub submissions are manual (L3).

How to build and test: `projects/g2digest/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh g2digest`).
