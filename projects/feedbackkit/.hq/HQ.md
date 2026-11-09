---
hq: 1
tier_ceiling: L1
verbs:
  health:  { tier: L0, runs_on: any }
  release: { tier: L3, runs_on: mac-runner, needs: [gh] }
---

# feedbackkit: HQ guidance

Has its own Supabase project (BACKEND=own) and its own CI. Its dashboard Worker deploys by hand; don't assume auto-deploy.

How to build and test: `projects/feedbackkit/CLAUDE.md`. Releases: `.hq/bin/release` (wraps `scripts/cut_release.sh feedbackkit`).
