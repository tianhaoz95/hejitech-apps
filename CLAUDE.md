# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Wee Hours is a newborn log (feeds, diapers, sleep) for iPhone, Apple Watch, widgets/Siri, Even Realities G2 glasses + R1 ring, and AI agents over MCP. Every input becomes one typed, append-only event log shared by a household. `docs/decisions.md` records product and architecture decisions the user made explicitly. Read it before proposing architectural changes, and don't reintroduce rejected options: no server-side inference, one unified on-device decision model, Supabase rather than CloudKit. The full design walkthrough is in `report/v0/site` (`report/v0/script/serve.sh`).

## Commands

```bash
scripts/dev.sh                     # supabase start, spec sync, llama.xcframework, models, xcodegen
cd ios && xcodegen generate        # WeeHours.xcodeproj is generated and git-ignored; edit ios/project.yml instead
scripts/sync-spec.sh               # copy spec/ files into each consumer (CI runs --check)

# Swift domain logic
cd ios/LogCore && swift test
cd ios/LogCore && swift test --filter LogCoreTests.LogCoreTests/testName
SUPABASE_IT=1 swift test --filter BackendIntegrationTests       # needs `supabase start`
cd ios/LogCore && swift run -c release logeval --model keywords --out /tmp/eval   # eval (CI gates on it)

# On-device Laya port vs. llama-server
cd ios/LayaRuntime && LAYA_MODEL=… LAYA_SERVER=http://127.0.0.1:8089 swift test

# Glasses app (Vite + Vitest)
cd glasses && npm test             # or: npx vitest run test/core.test.ts -t "name"
cd glasses && npm run typecheck && npm run build

# Backend
supabase start && node scripts/test-mcp.mjs     # MCP edge function integration checks
scripts/glasses-sim.sh --e2e                    # drives the Even Hub simulator end to end

# iOS simulator build (as CI does)
cd ios && xcodebuild -project WeeHours.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' build CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO
```

Local dev sign-in: `parent1@example.com` / `newborn-dev` (seeded household). MCP locally: `http://127.0.0.1:54321/functions/v1/mcp` with `Bearer wh_dev_local_token`.

## Architecture

**`spec/` is the single source of truth.** `event-types.json` holds the event types, fields and decision questions. `calibration.json` holds the fitted per-question temperatures, and `fixtures/status.json` holds derivation fixtures. `scripts/sync-spec.sh` copies them into `ios/LogCore/.../Resources`, the LogCore test fixtures and `supabase/functions/_shared/`. Edit `spec/` and then sync; never edit the copies.

**Derivation exists twice and is fixture-locked.** `ios/LogCore` (`Derive.swift`, `Status.swift`) and its TypeScript twin `supabase/functions/_shared/core.ts` both turn the event log into sessions, duplicates and the one-line status ("Fed 2h40m ago · left next · …"). The MCP function and the glasses app (`glasses/test/core.test.ts` imports it directly) use the TS copy. Both must pass `spec/fixtures/status.json`, so a behaviour change goes into both implementations and the fixtures.

**Voice pipeline (on the phone only).** WhisperKit transcribes, then LogCore's decision layer (`Interpreter.swift`, `Decision.swift`, `LayaPrompt.swift`) asks Laya questions shaped as category × phase rather than one flat type question. Clock times, relative times and quantities are parsed deterministically, not by the model. Calibrated confidence picks a tier: auto-commit, pick from two, or full list. The `DecisionModel` backends are in `ios/App/Sources/Services.swift`: on-device Laya (`ios/LayaRuntime`, a Swift port of llama.cpp's server-side decision path that runs on `ios/Vendor/llama.xcframework`), a llama-server on the Mac for development, and a keyword fallback. Models are bundled from `ios/App/Models` (`scripts/fetch-models.sh`, git-ignored).

**Data and sync.** Events are append-only, with corrections written as new events. The phone keeps SQLite in the App Group container (`ios/Shared/SharedStore.swift`), which it shares with the widgets. Sync with Supabase (`Sync.swift`) uses an outbox plus a seq cursor; RLS makes the tables append-only for clients (`supabase/migrations`). Local-only mode keeps the household on the phone, and signing in later re-homes the rows. The glasses never run inference: gestures write events directly, and hold-to-speak uploads a *capture* that a household phone processes later. The event id is derived from the capture id, so two phones converge on the same result.

**Agents.** The app records facts and the user's own agent interprets them: there is no in-app advice. `supabase/functions/mcp` serves the log over MCP with Supabase OAuth or `wh_…` personal access tokens (only hashes are stored).

## Releasing

`APPLE_TEAM_ID=68CTFST8W2 ./scripts/release_testflight.sh` uploads to TestFlight. `.github/workflows/testflight.yml` runs the same script on a published GitHub Release or a manual dispatch. Both reuse the existing HEJI Apple Development and Apple Distribution certificates; CI imports them from repo secrets. Never let signing mint new certificates. The app is iPhone-only and portrait. App Groups (`group.com.hejitech.weehours`) and Sign In with Apple are registered in the developer portal, and an API key can't create App Groups.
