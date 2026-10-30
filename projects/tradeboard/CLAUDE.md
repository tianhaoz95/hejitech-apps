# Trading Plan Board

Hosted board (portal + Board MCP + executor API, one Worker) and a local executor that alone talks
to the official Robinhood MCP. Layout and setup: `README.md`. Why things are the way they are:
`docs/decisions.md` (read it before changing behaviour; it lists every PRD ambiguity and the safer
reading taken). Going live: `docs/DEPLOY.md`.

**Safety rules are the product.** Never add an MCP tool that approves, places orders, edits policy,
controls the executor or reaches Robinhood; never let a discussion agent's text become an order;
never relax fail-closed behaviour to make something work. If a request conflicts with the PRD's
safety rules, the rule wins (PRD §4.2). Never place a live order yourself, not even a test one: the
first live order is the user's (§12.2).

## Commands (from the repo root)

```sh
npm run test:tradeboard          # core + executor unit tests
npm run typecheck:tradeboard
npm run build:tradeboard         # portal (WEB_ALLOW_LOCAL=1 without production env) + executor bundle

# local stack: `supabase start` from the repo root (seed user: owner@example.com / tradeboard-dev)
echo "SUPABASE_SERVICE_ROLE_KEY=<local service key>" > projects/tradeboard/services/web/.dev.vars
npm run dev:worker -w @tradeboard/web                # 127.0.0.1:8798, email sign-in for the seed user
node projects/tradeboard/scripts/test-api.mjs        # end to end: PRD §12.1 1–16 + auth, OAuth, limits
node projects/tradeboard/scripts/scan-tokens.mjs   # no token patterns in the repo (CI)
node projects/tradeboard/apps/executor/src/cli.ts help
```

Local-only seed credentials: agents `tba_dev_claude`, `tba_dev_gemini`, `tba_dev_muse`; executor
`tbx_dev_local` (id `local`). The integration test **resets the seed user's account row** (TOTP
enrolls again), signs up a second user to check boards stay private, then deletes that board, and drives the bundled executor against `scripts/mock-robinhood.mjs` (port 8766) and
`scripts/mock-model.mjs` (8767), with the executor's clock pinned inside market hours
(`TRADEBOARD_TEST_NOW`, honoured only against a 127.0.0.1 board).

## Architecture

- **One set of rows, one set of functions.** Portal and MCP both call `services/web/src/worker/board.ts`;
  every transition (create, edit/version, comment/question, ready, approve, reject/cancel, claim,
  step, receipt, sweep) is a `tradeboard.*` Postgres function holding the plan's row lock, so races
  can't skip a rule. `audit_log`, `plan_versions`, `receipts` are append-only by trigger; plans,
  comments and approvals can't be deleted.
- **Multi-user, private boards.** Anyone can sign up; every table carries `user_id` and every
  function and query is scoped to the caller's user (session, agent token/grant, executor
  credential each resolve to one user). Another user's plan is "not found". Account deletion
  (`tradeboard.delete_account`) is the only path that removes history.
- **Three credential kinds, never interchangeable**: the user's HttpOnly cookie (`/api/*`, plus a
  same-origin `X-Tradeboard: 1` header on writes), agent `tba_…` tokens or OAuth grants (`/mcp`
  only, bound to one agent id, 60 calls/min), executor `tbx_…` (`/api/executor/*` only).
  `index.ts` routes by credential before anything else.
- **Sign-up / sign-in** (`auth.ts`): Supabase Google/Apple proves the account (any account; its
  board is created on first use), TOTP (`@tradeboard/core` totp.ts, secret AES-GCM sealed
  with `TOTP_ENC_KEY`, single-use steps) proves the second factor; the page then drops the Supabase
  session.
- **Executor** (`apps/executor/src/engine.ts`): the §9.1 loop in order. Live needs the board's
  dry-run off + live checklist complete, `allow_live` in the machine's config, Robinhood connected,
  the confirmed account, and the model (or the policy's explicit waiver). Live switched on but
  blocked = a rejection naming why, never a silent simulation. The ref_id sent to Robinhood is the
  plan-version idempotency key, so retries can't double-order.
- **Time**: everything UTC on the wire (`utcDeep` normalises Postgres's `+00:00`), PT + ET in the
  portal (`ptEt`). The NYSE calendar in `core/src/time.ts` runs through `CALENDAR_THROUGH`; past it
  the market counts as closed. **Extend it every year.**

## Pitfalls

- Postgres function signatures resolve types at creation: write `tradeboard.plans`, not `plans`.
- Local Worker builds must not load `.env.production`: `dev:worker` builds with `--mode development`.
- Sign-in failures are throttled per client address (KV): locally everything is one address, so
  tests send their own `CF-Connecting-IP`.
- The Robinhood MCP reply shapes are parsed defensively (`brokerage.ts`); anything unreadable fails
  closed. Verify parsers against a real read (`tradeboard-executor check`) after Robinhood changes.
- Never put a real account number or token in the repo; the board only ever sees `••••1234`.

## Releasing

`scripts/cut_release.sh tradeboard --dry-run`, then for real. It bumps
`apps/executor/package.json` and publishes `tradeboard-v<version>`, whose workflow tests and bundles
the executor and attaches `tradeboard-executor.mjs`, `install.sh` and `policy.example.json`. Update
the executor with `bash install.sh <version>` on its machine. The Worker deploys on push to `main`.
