---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# hq: HQ guidance

HQ manages this repo, so changes to HQ itself are sensitive: anything that touches tiers, policy
checks, tokens or what agents may do is a "policy" card (L3), whatever its size. Small bug fixes
and tests elsewhere in HQ are fine as L1.

How to build and test: `projects/hq/CLAUDE.md`. Releases: `.hq/bin/release`.
