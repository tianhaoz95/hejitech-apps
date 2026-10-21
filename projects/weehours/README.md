# Wee Hours

[![Wee Hours CI](https://github.com/tianhaoz95/hejitech-apps/actions/workflows/weehours-ci.yml/badge.svg)](https://github.com/tianhaoz95/hejitech-apps/actions/workflows/weehours-ci.yml)

Part of the [HEJI monorepo](../../README.md): it shares one Supabase project, npm workspaces and CI plumbing with the other apps. Paths below are relative to `projects/weehours/`.

A newborn log built for 3am. You log a feed, diaper or nap in under three seconds: by voice, with a one-tap button, from a widget, from Siri, from an Apple Watch, or with an Even Realities G2 + R1 ring. Every input becomes one typed, append-only event log shared by both parents. The log also answers "what's next" in one line:

```
Fed 2h40m ago · left next · diaper 1h10m ago
```

Voice is understood **on the iPhone** by [Laya](https://huggingface.co/ggml-org/Laya-GGUF), a 0.4B decision model fine-tuned for baby logging ([wee-hours-baby-activity](https://huggingface.co/tianhaoz95/wee-hours-baby-activity), `ml/`), running through llama.cpp. It scores predefined options, never generates text, and when it isn't sure it asks you to choose with one tap.

> The full design, architecture and implementation walkthrough (with diagrams, eval numbers and screenshots) is in `report/v0/site`. Run `report/v0/script/serve.sh` to view it.

## What's here

| Path | What |
|---|---|
| `spec/` | The shared source of truth: event types and decision questions (`event-types.json`), fitted calibration, the eval utterances, and fixtures that every implementation must pass |
| `apps/ios/LogCore` | Swift package: event model, append-only derivation (sessions, duplicates, status line), the decision layer (Laya prompt port, two-step questions, confidence policy, deterministic time and number parsers), reminders, billing rules, SQLite store, Supabase sync, plus the `logeval` CLI |
| `apps/ios/LayaRuntime` | Runs Laya in-process with llama.cpp: a Swift port of llama.cpp's server-side decision path, verified against llama-server |
| `apps/ios/App`, `Widgets`, `Watch` | iPhone app (SwiftUI), widgets, Live Activity, App Intents (Siri / Action Button), StoreKit 2 paywall with a dummy store, watch app |
| `apps/glasses/` | Even Hub web app for G2 + R1: gesture logging, hold-to-speak capture, one-line HUD |
| `packages/core/` | `@weehours/core`: the TypeScript twin of LogCore's derivation, shared by the site, the MCP Worker and the glasses |
| `services/web/` | Website + Cloudflare Worker: landing, agent setup, account, legal pages, and the **MCP server** with its own OAuth endpoints |
| `../../supabase/schemas/weehours/` | Postgres schema `weehours` in the shared project: tables with RLS (append-only for clients), RPCs; migrations in `../../supabase/migrations/*_weehours_*`, seed in `../../supabase/seeds/weehours.sql` |
| `eval/` | Utterance generator and eval results (Laya flat vs. two-step, raw vs. calibrated), `laya.env` (the Laya model in use) and `report.py` (compares eval runs) |
| `ml/` | Laya fine-tuning on synthetic data: teacher-written utterances with blind label checks, TTS → Whisper, `laya.train`, GGUF, eval vs stock ([ml/README.md](ml/README.md)) |
| `scripts/` | Dev stack, glasses simulator (interactive and e2e), MCP test, eval, screenshots, llama.cpp xcframework build, TestFlight release |

## Quick start (macOS, Xcode 26+, Docker)

```bash
brew install xcodegen cmake supabase/tap/supabase
npm install                         # from the repo root: every project's workspaces
scripts/dev.sh                      # shared supabase start, spec sync, llama.xcframework, Xcode project
open apps/ios/WeeHours.xcodeproj    # run the "App" scheme on an iPhone simulator
```

Sign in with `parent1@example.com` / `newborn-dev` (or `parent2@…`). Both accounts belong to the seeded household and share half a day of log.

**No backend needed to try it:** tap *Use without an account*. The household then lives only on the phone, and logging, voice (bundled models), status, timeline, reminders, widgets, Siri and the watch all work. *Settings → Sign in to sync and share* later uploads the log, either as a new household or into your partner's with an invite code. Partner sync, the glasses relay and MCP need an account.

- **Bundled models.** `scripts/fetch-models.sh` (run by `dev.sh`) puts Laya (~450 MB), WhisperKit base.en (~150 MB) and the multilingual WhisperKit small for Spanish and Chinese (~210 MB) into `apps/ios/App/Models`, which the app ships, so voice works offline right after install. Without them the app falls back to downloading. They are git-ignored; before the App Store, consider Apple-hosted Background Assets to keep the binary small and update the model without an app update.
- **Voice in the simulator.** Hold the floating mic button (the simulator records from the Mac's microphone), or launch with `-demoText "finished, drank half"` to run a transcript through the same pipeline. With the bundled models, the default *On-device Laya* runs in the simulator on the CPU. You can also run `llama-server -m Laya-Q8_0.gguf --port 8089` and pick *Settings → Voice → Laya on Mac*.
- **Glasses.** `scripts/glasses-sim.sh` opens the official Even Hub simulator, signed in. `scripts/glasses-sim.sh --e2e` drives the simulator through its automation API, checks the backend and saves HUD screenshots.
- **MCP.** `npm run dev:worker -w @weehours/web` serves the site and the MCP endpoint `http://127.0.0.1:8788/mcp` (use `Authorization: Bearer wh_dev_local_token`, or connect an OAuth-capable client and sign in as a seeded parent). It needs `services/web/.dev.vars` with the local `SUPABASE_SERVICE_ROLE_KEY` (`supabase status`). `node scripts/test-mcp.mjs` runs the integration checks, the OAuth flow included.
- **Billing.** Run from Xcode to use `Subscriptions.storekit` (monthly, yearly, lifetime). Launched any other way, the paywall uses a built-in dummy store through the same entitlement path.
- **Eval.** `LAYA_MODEL=… LLAMA_SERVER_BIN=… scripts/eval.sh` re-runs the decision eval and refits `spec/calibration.json`. In CI, `weehours-llm-eval.yml` runs it on the real Laya (CPU) when the questions or the model change, monthly on the 15th, or by hand, and compares with `eval/results`.

## Tests

```bash
cd apps/ios/LogCore && swift test                                 # 37 tests, incl. the PRD acceptance criteria
SUPABASE_IT=1 swift test --filter BackendIntegrationTests         # against the local stack
cd apps/ios/LayaRuntime && LAYA_MODEL=… LAYA_SERVER=http://127.0.0.1:8089 swift test   # on-device port == llama-server
npm run test:weehours                                             # (repo root) core fixtures, glasses
node scripts/test-mcp.mjs                                         # MCP + OAuth against dev:worker
scripts/glasses-sim.sh --e2e                                      # glasses in the Even Hub simulator
```

CI (`.github/workflows/weehours-ci.yml`) runs the spec sync check, the TypeScript tests/typecheck/builds, LogCore tests with an eval regression gate, the shared Supabase schema (every project's migrations replayed, plus a drift check against `supabase/schemas/weehours`) with the MCP/OAuth integration against the Worker, and the iOS simulator build (app, widgets, watch).

## Hosted backend

Wee Hours runs on the Supabase project every HEJI app shares (`jitdzllkxfhlrxxvljhp`; see `../../supabase/README.md`), in its own `weehours` schema and Storage bucket. Release builds of the app default to it (`BackendConfig.production`); Debug builds use the local stack, and *Sign in → Server* can point either elsewhere. Accounts are shared: the same Google or Apple sign-in is the same user in every HEJI app.

The site and MCP server are one Cloudflare Worker (`services/web`, production `https://weehours.hejitech.workers.dev`), which is also the MCP OAuth server. Agents that can't do OAuth use personal access tokens (`wh_…`) created in *Settings → AI agents*. Only hashes are stored, and each token can be read-only or allowed to log. Setup and secrets: `docs/DEPLOY.md`.

## Releasing to TestFlight

From the repo root: `scripts/cut_release.sh weehours --dry-run`, then `scripts/cut_release.sh weehours` (next patch; or `minor`, `major`, `x.y.z`). It bumps `MARKETING_VERSION` in `apps/ios/project.yml`, pushes, and publishes GitHub Release `weehours-v<version>`, which runs `.github/workflows/weehours-testflight.yml`. That workflow also runs every Wednesday at 17:00 UTC from `main` (TestFlight builds expire after 90 days) and from the Actions tab. Each upload uses a UTC timestamp as its build number. Releases from before the monorepo (`v0.1.0`…`v0.1.2`) are in the archived `tianhaoz95/wee-hours` repo.

CI signs with the same team-wide HEJI identities as Waypack (`SIGNING_P12_*` = Apple Distribution, `DEV_SIGNING_P12_*` = the pinned Apple Development identity) through `.github/actions/apple-signing`, so it never creates certificates. `WEEHOURS_FEEDBACKKIT_RELEASE_TOKEN` (optional) lets the upload announce shipped FeedbackKit fixes.

Locally, `APPLE_TEAM_ID=68CTFST8W2 scripts/release_testflight.sh` does the same upload. It needs the App Store Connect API key (`FA_ASC_*` / `FA_KEY_LOCATION`, or `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_PATH`), the bundled models (`scripts/fetch-models.sh`), and exactly one Apple Development and one Apple Distribution identity for HEJI in the keychain.
