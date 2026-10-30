# Trading Plan Board

Dated, collaborative trade plans that hosted AI agents debate and only you approve, plus a local
executor that alone talks to Robinhood. Built from the owner's PRD (v1.0, 2026-10-29). Long equity
buys in a dedicated Robinhood MCP account; dry-run by default. **You remain responsible for every
trade this system places. Nothing here is financial advice.**

```
Discussion agents (hosted)          You (browser / phone)
  │  MCP over HTTPS,                  │  HTTPS: Google/Apple + TOTP → HttpOnly session cookie
  │  per-agent token or OAuth         │
  ▼                                   ▼
┌───────────────────────────────────────────────────────────┐
│ Board: Cloudflare Worker  tradeboard.hejitech.workers.dev │
│  /mcp        Board MCP: plans and discussion only         │
│  /, /plans/… portal (same rows, same functions)           │
│  /api/executor/*  executor API (tbx_ credential only)     │
│  Supabase schema `tradeboard`: plans, versions, comments, │
│  approvals, policy versions, receipts, audit log          │
└───────────────────────────────────────────────────────────┘
  ▲  executor polls OUTBOUND over HTTPS (no inbound port)
  │
┌───────────────────────────────────────────────────────────┐
│ Executor (your machine; the DGX Spark for now)            │
│  tradeboard-executor run: poll → claim → gates →          │
│  deterministic policy validator → re-quote + drift →      │
│  local model sanity check (Ollama/vLLM/llama.cpp, temp 0) │
│  → place via Robinhood MCP → read back → receipt          │
│  ~/.tradeboard: config, Robinhood OAuth tokens (0600)     │
└───────────────────────────────────────────────────────────┘
  │  MCP over HTTPS, OAuth on a loopback redirect
  ▼
Robinhood MCP  https://agent.robinhood.com/mcp/trading  (dedicated agentic account only)
```

| Path | What |
|---|---|
| `packages/core` | `@tradeboard/core`: ticket and plan rules, state vocabulary, market calendar and PT/ET times, policy + deterministic validator, drift, TOTP, the sanity-check contract, executor protocol |
| `services/web` | `@tradeboard/web`: the Worker (portal API, Board MCP + OAuth, executor API, minute cron) and the portal pages |
| `apps/executor` | `@tradeboard/executor`: the daemon and CLI, Robinhood MCP client (loopback OAuth), model client; `deploy/install.sh` |
| `supabase/schemas/tradeboard` (repo root) | the schema; every state change is a Postgres function |
| `scripts/test-api.mjs` | end-to-end test of PRD §12.1 against the real Worker, with `mock-robinhood.mjs` and `mock-model.mjs` |
| `policy.example.json` | the §9.2 defaults (review every value before live) |

## Run the tests (one command each)

```sh
npm run test:tradeboard                 # core (42) + executor (31) unit tests
npm run typecheck:tradeboard
# end to end (local Supabase + Worker): see CLAUDE.md, then
node projects/tradeboard/scripts/test-api.mjs   # 25 checks: PRD §12.1 tests 1–16, sign-in, OAuth, limits
```

## Set up

1. **Board** (once): `docs/DEPLOY.md` (database, Worker, secrets, auth redirect).
2. **Sign in**: open the portal, sign in with Google or Apple (only the owner's email can), scan the
   QR code into an authenticator app and enter the code. The session lasts 7 days, in an HttpOnly
   cookie. Lost the authenticator? `docs/DEPLOY.md` §Recovery.
3. **Agents**: Agents page → register a name (`claude`, `gemini`, `muse`). Apps with OAuth add a
   custom connector `https://tradeboard.hejitech.workers.dev/mcp` and you pick which agent it
   speaks as; others get a `tba_…` token (shown once). Revoke either any time.
4. **Executor**: Executor page → New executor credential (`tbx_…`, shown once). On the machine:

   ```sh
   bash install.sh 0.1.0                       # from the tradeboard-v0.1.0 release (or --local from a checkout)
   ~/.tradeboard/bin/tradeboard-executor setup # board URL, credential, the agentic account number, model endpoint
   ~/.tradeboard/bin/tradeboard-executor auth  # Robinhood sign-in on the loopback redirect (below)
   ~/.tradeboard/bin/tradeboard-executor check # board, Robinhood, account, approvals setting, model
   systemctl --user enable --now tradeboard-executor   # Linux (macOS: the launchctl line install.sh prints)
   ```

   **Robinhood sign-in (loopback only).** Robinhood accepts only loopback redirects, so the executor
   listens on `http://127.0.0.1:8765/oauth/callback` and opens the Robinhood login. On a machine
   without a browser (the Spark over SSH), either forward the port first
   (`ssh -L 8765:127.0.0.1:8765 dgx`, then open the printed URL on your laptop), or open the URL
   anywhere and paste the full URL the browser ends on back into the prompt (it carries a one-time
   code, never a password). Tokens are stored in `~/.tradeboard/robinhood-oauth.json` (mode 600)
   and refreshed automatically; a failed refresh shows on the portal's Executor page.

5. **Model**: any OpenAI-compatible endpoint that does JSON at temperature 0. On the Spark:
   Ollama's `gemma4:26b` (already there; 4-bit, 17 GB); `tradeboard-executor model-check` runs a
   matching and a mismatched fixture. Thinking models need room to reason before the JSON:
   `model.max_tokens` (default 2048); `model.reasoning_effort: "none"` turns thinking off where
   Ollama supports it. A model timeout or unparseable reply is a rejection, never a bypass.

## Dry-run (the default)

Everything runs except the order: plans are claimed, validated, re-quoted, sanity-checked and get a
`simulated` receipt marked Dry-run everywhere. The DEMO plan created with the board is dry-run only.

## Live mode (§12.2: your decision, never code alone)

All of these, or the executor stays in dry-run:

1. Executor page → **Live-mode checklist**: confirm the dedicated account (as the executor reports
   it, `••••1234`), the funding cap, the policy version, and Robinhood's trade-approvals mode
   (**A**: approvals off in the Robinhood app, your portal approval is the gate; **B**: approvals on,
   orders become proposals you place in the app, then **Mark manually filled**).
2. On the executor machine set `"allow_live": true` in `~/.tradeboard/config.json`.
3. Executor page → **Turn dry-run off** (the dialog says it plainly: real-money trades in the
   dedicated account, you remain responsible).
4. The first live order must be a limit order of at most `first_live_order_max_usd` (policy,
   default $100), verified by read-back. If it fails, the board goes back to dry-run.

## Stop it

- **Pause** (portal): no new claims; resume any time.
- **Kill** (portal, confirmed): stops claiming within one poll (≤ 30 s) and stops any plan in flight
  before the order is placed; stays stopped until you resume.
- **Local kill file**: `touch ~/.tradeboard/KILL` on the executor machine does the same if the
  portal is unreachable; `rm` it to allow again.
- Neither cancels an order already placed on Robinhood; do that in the Robinhood app.

Architecture, decisions and the PRD ambiguities resolved: `docs/decisions.md`. Going live: `docs/DEPLOY.md`.
