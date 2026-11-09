# HQ decisions

Settled with the owner while writing the PRD (2026-11-08), plus the defaults chosen while building
v0.1 (the owner said "use your best judgement"; each is easy to change).

## From the PRD discussion

1. **Control, not capabilities.** HQ owns scheduling, the queue, tiers, budget, approvals and the
   inbox. Skills, scripts and CI keep doing the work and stay usable by hand.
2. **Self-contained and portable.** Repo knowledge lives in the repo's `.hq/` folders (`HQ.md`
   frontmatter that HQ enforces + prose agents read, `bin/` verbs that wrap the repo's own
   scripts). HQ's code never names a project (`scripts/check_coupling.mjs`).
3. **Opinionated, not coupled.** The card schema, tiers, the evidence rule, inbox caps and the
   reviewer step are built in and the same for every repo.
4. **Skills.** Repo-specific skills stay in the repo; generic procedures may later be distributed by
   HQ as a catalog, but they always run locally. HQ's own state and actions are MCP tools.
5. **One entry point, three ways in.** `get_context`, reached through HQ's launch prompt
   (guaranteed), the MCP server's instructions, and one line in `AGENTS.md`.
6. **Enforcement in code.** Tiers, budgets, WIP limits and the kill switch are checked by the Worker
   before anything runs; only the runner holds credentials.

## Defaults chosen for v0.1 (open questions Q1–Q7 in the PRD)

| # | Question | Chosen | Why |
|---|---|---|---|
| Q1 | Pushed PRs or local branches? | **Configurable, off by default** (`push: false` in the root `HQ.md`). Builds land on local `hq/<card>` branches in worktrees under `~/.hq/worktrees`. | The repo is public and `heji-build-next` keeps builds local today; flipping `push: true` makes the runner push and open a PR. |
| Q2 | Surface new project ideas? | **Allowed as cards** (kind `portfolio`), never built unasked. | The CEO prompt doesn't generate ideas; a scout can be added for it. |
| Q3 | May HQ run releases? | **No: release verbs are L3** everywhere. You start them from a card (dry run first). | Releases reach users. |
| Q4 | Weekly budget | **$40** (`weekly_budget_usd`). The first real scout run cost $0.60. | A cap to start from; scouts pause when it's reached, builds finish. |
| Q5 | Name | **HQ** | |
| Q6 | Store | **Cloudflare D1** (+ R2 for screenshots), `BACKEND=none` for Supabase. | HQ is single-tenant and Worker-only; it stays off the shared Supabase project entirely, so it can never touch another project's data. |
| Q7 | Where the code lives | **`projects/hq/`**, written to move (coupling check, fixture-repo tests). | |

## Other v0.1 choices

- **Single owner per deployment**, signed in with the `HQ_OWNER_TOKEN` secret (portal, iOS app,
  MCP consent). Runners and headless agents use tokens the owner mints (`hq_run_…`, `hq_agt_…`),
  stored hashed. MCP clients that support OAuth connect at `/mcp` and the owner approves them.
- **Every project starts at tier ceiling L1** (no L0 auto-merges yet). Promotion is an L3 edit to
  `HQ.md` after a track record.
- **Inbox cap** = cards waiting for a decision at once (5), not new cards per day: the CEO's ranking
  decides which five you see; the rest wait in the backlog.
- **Push notifications**: the iOS app posts a local digest notification from a background refresh;
  APNs push is a later step (it needs a push key and a server sender).
- **Agents**: the `claude` adapter (Claude Code headless) is built and tested; any other agent runs
  through a command template (`HQ_AGENT_<NAME>_CMD`). Antigravity's and Codex's headless modes were
  not available on this Mac, so those templates are untested.
- **Weekly memo** = the CEO run's `MEMO:` section, shown as the run's summary.
