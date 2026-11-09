---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# tether: HQ guidance

Phone-to-monitor tiling workspace (iOS, Android, Web + MCP). Never store passwords or private keys.

How to build and test: `projects/tether/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh tether`).
