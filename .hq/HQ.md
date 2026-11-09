---
hq: 1
repo: tianhaoz95/hejitech-apps
tier_ceiling: L1          # nothing in this repo is L0 until HQ earns it (promotion is an L3 edit here)
inbox_cap: 5
weekly_budget_usd: 40
max_open_prs: 4
wip_per_project: 1
push: false               # builds stay on local hq/<card> branches; set true to push and open PRs
ceo_schedule: daily
agents:
  ceo: claude
  scout: claude
  executor: claude
  reviewer: claude
scouts:
  - { name: heji-fix-ci, schedule: daily, card_limit: 3 }
  - { name: heji-update-toolchain, schedule: weekly, card_limit: 2 }
never: [secrets, new-certificates, delete-user-data, app-store-review-submission]
---

# hejitech-apps: HQ guidance

A monorepo of small products (see the root README) sharing CI plumbing and, for some, one Supabase
project. What matters, in order:

1. **Main stays green and releases keep working.** A red CI run on main, a TestFlight build that
   uploaded but never processed, or a Worker that stopped auto-deploying beats any feature.
2. **Projects stay isolated** (root CLAUDE.md, supabase/GRADUATION.md). Never propose a change that
   ties two projects together; `scripts/check_isolation.mjs` and `graduation_check.sh` must pass.
3. **Keep proposals small.** One card = one change a reviewer can read in five minutes.

Leave alone: brand-new products and ideas (the owner originates those), App Store review
submissions, Play Console, Even Hub portal submissions, anything that signs with a new certificate.

Releases go through `scripts/cut_release.sh` only (each project's `.hq/bin/release`).
How to build and test each project: its own `CLAUDE.md`.
