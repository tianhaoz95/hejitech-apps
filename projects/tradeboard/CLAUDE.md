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

# Mac app (Tauri; bundles the executor + install.sh into src-tauri/resources first)
npm run build -w @tradeboard/desktop
(cd projects/tradeboard/apps/desktop && npm run tauri -- build --debug -b app --no-sign)
TRADEBOARD_HOME=/tmp/tb "projects/tradeboard/apps/desktop/src-tauri/target/debug/bundle/macos/Tradeboard Executor.app/Contents/MacOS/tradeboard-executor-app"

# iOS app (TradeboardKit tests + simulator build)
swift test --package-path projects/tradeboard/apps/ios/TradeboardKit
(cd projects/tradeboard/apps/ios && xcodegen generate)
xcodebuild -project projects/tradeboard/apps/ios/Tradeboard.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' -derivedDataPath projects/tradeboard/apps/ios/.derived CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO build
```

The promo video's edit is `branding/promo-videos/src/tradeboard-launch` (Remotion, `branding/README.md`).

App Review demo account: `POST /api/review-sign-in` (`services/web/src/worker/review.ts`), local
`review@example.com` / `tradeboard-review-dev`; every sign-in resets that board to DEMO plans in
dry-run with no executor. iPhone Debug launch arguments: `-reviewSignIn` (signs in through it),
`-emailSheet`, `-openSettings`, `-openPlan ready|debated`, `-planTab N` (screenshots without taps: `scripts/store_screenshots.sh tradeboard`). Production:
`scripts/review_account.sh tradeboard` (`review.env`).

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
- **`/` is two pages**: the Worker serves the board to a request with a session cookie and the public
  landing page (`welcome/`, also at `/welcome/`) to everyone else. Terms and Privacy are `terms/` and
  `privacy/`; only app pages carry `noindex`.
- **Sign-up / sign-in** (`auth.ts`): Supabase Google/Apple proves the account (any account; its
  board is created on first use), TOTP (`@tradeboard/core` totp.ts, secret AES-GCM sealed
  with `TOTP_ENC_KEY`, single-use steps) proves the second factor; the page then drops the Supabase
  session.
- **Executor** (`apps/executor/src/engine.ts`): the §9.1 loop in order. Live needs the board's
  dry-run off + live checklist complete, `allow_live` in the machine's config, Robinhood connected,
  the confirmed account, and the model (or the policy's explicit waiver). Live switched on but
  blocked = a rejection naming why, never a silent simulation. The ref_id sent to Robinhood is the
  plan-version idempotency key, so retries can't double-order.
- **Mac app** (`apps/desktop`, Tauri, `com.hejitech.tradeboard.executor`): a control panel, never
  a second executor. It installs the bundled CLI with the bundled `install.sh --file`, runs the CLI's
  own commands (`setup` with secrets in env vars, `auth`, `check`, `model-check`), starts/stops the
  launchd service `com.hejitech.tradeboard-executor` (stop also disables it so it stays stopped),
  writes/removes `KILL`, and reads `status.json` (written by the daemon every heartbeat) and
  `executor.log`. It never approves, places or edits orders. A newer app updates an older installed
  CLI on launch (never downgrades). Its version is the executor's (`tauri.conf.json` reads
  `apps/executor/package.json`). Updater key: `~/Credentials/tradeboard-updater.key`, secret
  `TRADEBOARD_TAURI_SIGNING_PRIVATE_KEY`; installed apps poll `tradeboard-latest/latest.json`.
- **iPhone app** (`apps/ios`): the board, approvals and Settings → Connect an Agent (the portal's
  Agents page: MCP URL, register, tokens, OAuth disconnect). Settings → Robinhood on This iPhone is a
  read-only sign-in preview (`TradeboardKit/Robinhood.swift`, decisions.md "Robinhood on the iPhone"):
  its MCP client refuses every tool outside its read-only list. Keep it that way until a phone
  executor with every executor gate is designed.
- **Strategy document** (`core/src/strategy.ts`, `strategy_versions`/`strategy_proposals`): guidance,
  never a gate. Users write versions; agents only `propose_strategy`; the interview guide and the
  "offer an interview when there's none" rule live in `INTERVIEW_GUIDE` and the MCP `initialize`
  instructions / `get_strategy.next_step`. Plans store `fit_with_strategy` and `strategy_version`.
  The executor's `model.strategy_advisory` note goes on receipts and must never reject.
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
the executor and attaches `tradeboard-executor.mjs`, `install.sh` and `policy.example.json`,
`tradeboard-mac-release.yml` (`scripts/release_mac.sh`) builds, notarizes and attaches the Mac app
(DMG + updater; both workflows refresh the rolling `tradeboard-latest` prerelease when the tag is the
newest, `scripts/publish_latest.sh`), and
`tradeboard-testflight.yml` uploads the iPhone app (`scripts/release_testflight.sh`) with the same
version: it reads the executor's `package.json` and overrides `MARKETING_VERSION`, so `project.yml`'s
value is only the local default. It refuses until the in-app What's New describes the version. Update
the executor with `bash install.sh <version>` (or `latest`) on its machine; the Mac app updates itself and its executor. The Worker deploys on push to `main`.
