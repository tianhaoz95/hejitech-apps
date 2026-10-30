# Decisions

The PRD (v1.0, 2026-10-29) is the spec. This page records the owner's choices, the stack calls, and
every place the PRD was ambiguous with the reading taken: always the safer one (fail closed, require
human approval, don't execute), as the PRD asks.

## Owner's choices (2026-10-29)

- **Name** `tradeboard` (schema, tag prefix `tradeboard-v`, `tradeboard.hejitech.workers.dev`).
- **Anyone can sign up (2026-10-30)**: the PRD describes one owner; the owner decided the service
  is for whoever needs it. Every user gets a private board (their own plans, policy, agents,
  executors, receipts, audit log), and their MCP agents connect by signing in with the same
  account (OAuth consent names the agent; a new name is registered). Every table carries
  `user_id`, every function checks it, and another user's plan is simply "not found". The PRD's
  safety rules apply per board unchanged. Users can delete their board (Account page), the one
  path that removes history.
- **Portal sign-in**: Google or Apple through the shared Supabase project, then a TOTP code checked
  by the Worker (enrolled on first sign-in), which issues its own HttpOnly SameSite=Strict session
  cookie (7 days). The PRD's "strong password + TOTP or equivalent": the Google/Apple account is the
  first factor; the second stays because approvals can place real orders.
- **Executor host**: the DGX Spark for now, but nothing ties it there: it runs on any machine with
  Node ≥ 22.18 and any OpenAI-compatible local model endpoint (Ollama, vLLM, llama.cpp).
- **Scope**: everything (PRD phases 0–2), production and release ready. Only the steps that need the
  owner remain: the Robinhood sign-in, the live-mode checklist and the first live order.

## Local model (2026-10-30)

The PRD asks for a 70–80B-class model; the owner chose **whatever is already on the DGX Spark**
instead of downloading one. Measured with `tradeboard-executor model-check` on the Spark (Ollama
0.32.9, temperature 0, JSON schema): `gemma4:26b` (17 GB, Q4_K_M) passed the matching plan and
failed the mismatched one on every run, in 4–15 s; `ornith-1.5:35b` gave the same verdicts once the
reply budget allowed for its thinking. With the old 400-token budget both thinking models sometimes
ran out mid-JSON, which counted as a fail (never a pass): `model.max_tokens` is now 2048 and
configurable. Default: `gemma4:26b`. The "abliterated" model on the Spark is deliberately not used
(its safety tuning is removed), nor are the `:cloud` entries (not local). The model only
sanity-checks; the deterministic validator and every other gate are unchanged.

## Strategy document (2026-10-30)

Each user can keep one high-level trading strategy (Markdown, like an AGENTS.md for their board):
objectives, horizon, universe, sizing, entries, exits, temperament, how to work with them. The
owner's call, with one boundary: **it guides discussion and never enforces anything.**

- **Only the user makes a version effective** (Strategy page; every save is a version). Agents read
  it (`get_strategy`) and can only *propose* a draft (`propose_strategy`), which does nothing until
  the user adopts it, optionally edited. So an agent can't rewrite the philosophy to justify a trade.
- **No strategy yet → offer an interview.** The MCP `initialize` instructions and `get_strategy`'s
  `next_step` tell agents to ask once whether the user wants a ~10-minute interview, and to follow
  `get_strategy_interview_guide` (`core/src/strategy.ts` `INTERVIEW_GUIDE`): ask first, no advice,
  never ask for account numbers, one question at a time, the topics in order, red lines turned into
  policy settings, draft with the template, show it, then propose.
- **Hard limits belong in the policy.** `policyHints` spots lines that read like rules ("never buy
  X", "no more than $2,000 a trade", "limit orders only") and names the policy setting that would
  enforce them, on the Strategy page and in the tools' replies.
- **Plans say how they fit**: a `fit_with_strategy` section (material, versioned) and the strategy
  version the plan was last written against; the plan page shows "written against v1 (now v2)".
  Editing the strategy doesn't void approvals.
- **The executor's model can add an advisory note** (`model.strategy_advisory`, off by default): "fits /
  doesn't fit / unclear" plus a sentence, on the receipt. It never rejects. Measured on the Spark
  with gemma4:26b: a long-hold plan → yes (13 s), an intraday scalp against a hold-for-months
  strategy → no (4 s).

## Stack

- **Board**: one Cloudflare Worker (portal pages, owner API, Board MCP with its own OAuth server,
  executor API, minute cron), on the shared Supabase project's `tradeboard` schema, as every HEJI
  project does. The PRD suggested D1; Postgres row locks make the claim/approve/edit races
  impossible rather than unlikely, and the single-database invariant holds either way.
- **No client reads the database.** No grants to `anon`/`authenticated`; every read and write goes
  through the Worker, so the portal and MCP see the same rows (§5.2.1). Every state change is a
  Postgres function in one transaction with the plan's row lock.
- **Append-only by trigger**: `audit_log`, `plan_versions`, `receipts` refuse UPDATE/DELETE; `plans`,
  `comments`, `approvals` refuse DELETE. Even a Worker bug can't erase history.
- **Executor in TypeScript** (the PRD mentions the Python MCP SDK as an example): one language with
  the board, so the ticket, policy and validator code is literally the same (`@tradeboard/core`).
  Official MCP TypeScript SDK 1.31.0 for the Robinhood client (OAuth discovery, dynamic registration,
  PKCE, refresh). Shipped as one bundled file per release.
- **Agents connect two ways**, both bound to one registered agent id and revocable: OAuth (the owner
  approves on a consent page and picks the agent id; needed by Claude.ai-style connectors) and
  per-agent `tba_…` bearer tokens. Revoking an agent cuts off both at once. 60 tool calls a minute
  per agent (`AGENT_RATE_PER_MIN`).
- **Policy lives in the board** as versions (the portal edits it, with confirmation); the executor
  loads the newest version between plans, caches it in `~/.tradeboard/policy.json`, records the
  version on every receipt, and refuses an invalid one. The PRD calls it "a file on the executor
  machine, mirrored in the board"; keeping the editor in the portal means one source and a logged
  history. The account number is not policy: it stays in the executor's `config.json`.

## The PRD's ambiguities, resolved

| Where | Ambiguity | Reading taken |
|---|---|---|
| §6.3, §9.1 | `claim_plan` "moves approved → validated (after validation)" but validation runs after the claim | The claim only locks (status stays `approved`); the executor moves it to `validated` after the policy, drift and model checks pass, then to `executing` right before placing. Each step re-checks the gate on the board. |
| §9.1 4f | "if dry-run, go to step 8 with a simulated receipt" would skip validation | Dry-run runs every check (policy, re-quote, drift, model) and skips only the order, so a dry-run receipt means the same plan would have been placed. |
| §6.3 | "pause → rejected" | A pause that lands mid-flight releases the claim (the plan stays approved and runs after resume, if still valid); a kill rejects it with `killed`. Neither places an order. |
| §6.5.2 | "until market close on the approval day" makes an evening approval expire at once | It lasts to the close of the next session that ends after the approval (an evening approval covers the next trading day), never past `valid_until`. |
| §6.5.5 | Outside market hours, plans "queue as approved" | The executor doesn't claim outside the session; the plan waits unclaimed until the next session in its window, or expires. |
| §6.3 | Which human questions block | Every open owner question, on any section, blocks ready/approve and voids an approval; reopening a resolved one does the same. Agent questions are listed but don't block. |
| §7.1 | `request_changes` only from `ready` | Also from `approved` (an agent's objection voids the approval): an extra stop, never an extra go. |
| §6.5.4 | When staleness is checked | On mark-ready, on approve, every minute for ready/approved plans, and by the executor's validator. |
| §9.2 | `max_daily_loss_usd` "from the day's receipts" (buys can't realise a loss) | Today's live fills marked to the fresh quote: the drawdown on what was bought today. Over the limit, the executor pauses itself and posts a note. If it can't be computed, live orders are refused. |
| §9.2 | `max_open_plans_per_day` | Orders placed (or simulated, or proposed) per market day, counted from receipts. |
| §10, §12.1 test 11 | Live switched on but something blocks it (account, model, checklist) | The plan is rejected with the reason (`wrong_account_rejected` for the account) instead of being quietly simulated. |
| §10 | Mode detection | `get_trade_approval_setting` and the review's `customer_approval_required`. Mode A with approvals on in Robinhood is refused; unknown = Mode B behaviour (no fill without a read-back). A proposal leaves the plan "executing, awaiting manual placement" until the owner marks it filled or cancels it. |
| §9.1 8, §11.5 | Uncertain order outcome | Read back first; if Robinhood shows the order, its receipt is posted; if it proves no order exists, one retry with the same `ref_id` (Robinhood dedupes on it). Still unknown: a failed receipt, and the executor pauses itself for the owner to check. After a crash, recovery only reads back; it never places. |
| §12.2 | "the first live test is a single small limit order" | Enforced: while `live_trial_pending`, a live order must be a limit order ≤ `first_live_order_max_usd` (new policy setting, default $100). A failed first live order flips the board back to dry-run. |
| §12.2 | "Live mode must not be enabled by code alone" | Three independent switches: the portal's dry-run toggle (only after the checklist), `allow_live` in the executor machine's own config, and the checklist itself (which re-opens whenever the policy changes or the reported account differs). |
| §5.2.2, §11.6 | Confirming the account in the portal without writing account numbers to the board | The executor reports a mask (`••••1234`); the owner confirms that. Full order ids appear only on the plan's receipt detail; lists and agents see 8 characters. |
| §6.1 | `side: buy only` and policy `allowed_sides` | Both enforced; a policy listing `sell` is refused (that's a later phase with its own review). |
| §4.1 | Stop orders "a policy change, not a code change" | The ticket, validator, drift check and Robinhood mapping support `stop_limit`/`stop_market`; the default policy doesn't allow them. |
| §6.1 | Ticker format | 1–5 uppercase letters with an optional class suffix (`BRK.B`); never a company name. |
| §15 | "Pending decisions surfaced in the portal" | The Executor page's checklist lists each (account, funding, policy, approvals mode, hosting, model) as Pending/Done. |

## Market calendar

`core/src/time.ts` holds NYSE full holidays and 1 p.m. closes for 2026–2027 (`CALENDAR_THROUGH`).
Past the table the market counts as closed and nothing executes, so the calendar needs a yearly
update (add the next year's dates from the NYSE site and move `CALENDAR_THROUGH`).

## Things measured or checked

- The Robinhood quote shape (`brokerage.ts` parser, its test fixture) comes from one read-only
  `get_equity_quotes` call on 2026-10-29; account, position, order and approval-setting shapes are
  parsed defensively and must be confirmed with `tradeboard-executor check` on the real account
  before live mode.
