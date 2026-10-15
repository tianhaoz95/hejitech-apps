# Wee Hours

[![CI](https://github.com/tianhaoz95/wee-hours/actions/workflows/ci.yml/badge.svg)](https://github.com/tianhaoz95/wee-hours/actions/workflows/ci.yml)

A newborn log built for 3am. You log a feed, diaper or nap in under three seconds: by voice, with a one-tap button, from a widget, from Siri, from an Apple Watch, or with an Even Realities G2 + R1 ring. Every input becomes one typed, append-only event log shared by both parents. The log also answers "what's next" in one line:

```
Fed 2h40m ago · left next · diaper 1h10m ago
```

Voice is understood **on the iPhone** by [Laya](https://huggingface.co/ggml-org/Laya-GGUF), a 0.4B decision model running through llama.cpp. It scores predefined options, never generates text, and when it isn't sure it asks you to choose with one tap.

> The full design, architecture and implementation walkthrough (with diagrams, eval numbers and screenshots) is in `report/v0/site`. Run `report/v0/script/serve.sh` to view it.

## What's here

| Path | What |
|---|---|
| `spec/` | The shared source of truth: event types and decision questions (`event-types.json`), fitted calibration, the eval utterances, and fixtures that every implementation must pass |
| `ios/LogCore` | Swift package: event model, append-only derivation (sessions, duplicates, status line), the decision layer (Laya prompt port, two-step questions, confidence policy, deterministic time and number parsers), reminders, billing rules, SQLite store, Supabase sync, plus the `logeval` CLI |
| `ios/LayaRuntime` | Runs Laya in-process with llama.cpp: a Swift port of llama.cpp's server-side decision path, verified against llama-server |
| `ios/App`, `ios/Widgets`, `ios/Watch` | iPhone app (SwiftUI), widgets, Live Activity, App Intents (Siri / Action Button), StoreKit 2 paywall with a dummy store, watch app |
| `supabase/` | Postgres schema with RLS (append-only for clients), RPCs, seed data, capture audio bucket, and the **MCP server** edge function |
| `glasses/` | Even Hub web app for G2 + R1: gesture logging, hold-to-speak capture, one-line HUD |
| `eval/` | Utterance generator and eval results (Laya flat vs. two-step, raw vs. calibrated) |
| `scripts/` | Dev stack, glasses simulator (interactive and e2e), MCP test, eval, screenshots, llama.cpp xcframework build |

## Quick start (macOS, Xcode 26+, Docker)

```bash
brew install xcodegen cmake supabase/tap/supabase
scripts/dev.sh                      # supabase start, spec sync, llama.xcframework, Xcode project
open ios/WeeHours.xcodeproj         # run the "App" scheme on an iPhone simulator
```

Sign in with `parent1@example.com` / `newborn-dev` (or `parent2@…`). Both accounts belong to the seeded household and share half a day of log.

- **Voice in the simulator.** Type into "Or type…" on the home screen; it runs the same pipeline as speech. For the real model, run `llama-server -m Laya-Q8_0.gguf --port 8089` and pick *Settings → Voice → Laya on Mac*. Or download the model in Settings to use the on-device runtime; the simulator runs it on the CPU.
- **Glasses.** `scripts/glasses-sim.sh` opens the official Even Hub simulator, signed in. `scripts/glasses-sim.sh --e2e` drives the simulator through its automation API, checks the backend and saves HUD screenshots.
- **MCP.** The endpoint is `http://127.0.0.1:54321/functions/v1/mcp` with `Authorization: Bearer wh_dev_local_token`. `node scripts/test-mcp.mjs` runs the integration checks.
- **Billing.** Run from Xcode to use `Subscriptions.storekit` (monthly, yearly, lifetime). Launched any other way, the paywall uses a built-in dummy store through the same entitlement path.
- **Eval.** `LAYA_MODEL=… LLAMA_SERVER_BIN=… scripts/eval.sh` re-runs the decision eval and refits `spec/calibration.json`.

## Tests

```bash
cd ios/LogCore && swift test                                      # 35 tests, incl. the PRD acceptance criteria
SUPABASE_IT=1 swift test --filter BackendIntegrationTests         # against local supabase
cd ios/LayaRuntime && LAYA_MODEL=… LAYA_SERVER=http://127.0.0.1:8089 swift test   # on-device port == llama-server
cd glasses && npm test                                            # gestures, WAV, shared fixtures
node scripts/test-mcp.mjs                                         # MCP server
scripts/glasses-sim.sh --e2e                                      # glasses in the Even Hub simulator
```

CI (`.github/workflows/ci.yml`) runs the spec sync check, LogCore tests with an eval regression gate, the glasses tests and build, the Supabase + MCP integration, and the iOS simulator build (app, widgets, watch).

## Auth for the hosted project

Google and Apple sign-in go through Supabase Auth, using the same session for the app and for MCP agents that support OAuth. Before cloud launch:

1. Create the Supabase project and run `supabase link` then `supabase db push`, and deploy the function with `supabase functions deploy mcp`.
2. Set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/SECRET` and the Apple service id (see `supabase/config.toml`), and enable the providers.
3. Point the app at the project in *Sign in → Server*, or change `BackendConfig`.

Agents that can't do OAuth use personal access tokens (`wh_…`) created in *Settings → AI agents*. Only hashes are stored, and each token can be read-only or allowed to log.
