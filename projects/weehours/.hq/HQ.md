---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  verify:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# weehours: HQ guidance

Baby sleep/feeding log with on-device model (Laya), watch and Even G2 glasses plugin. Night-time use: speed and reliability of logging matter most.

How to build and test: `projects/weehours/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh weehours`).
