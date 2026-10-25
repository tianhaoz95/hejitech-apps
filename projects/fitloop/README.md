# FitLoop

The plan your own AI agent writes (workouts and meals, around your goals, time and limits), followed
on iPhone, Apple Watch, the web and Even G2 glasses, with check-ins and in-the-moment feedback flowing
back to the agent over MCP. Docs: <https://tianhaoz95.github.io/hejitech-apps/fitloop/>. Working on
it: [`CLAUDE.md`](CLAUDE.md).

```
projects/fitloop/
  packages/core/        @fitloop/core: plan format + validator, day state and adherence, settings and
                        checks, the agent's plan guide, G2 screens + R1 state machine (TypeScript)
  services/web/         @fitloop/web: Cloudflare Worker (web app, /api, /mcp + OAuth)
  apps/glasses/         @fitloop/glasses: Even Hub plugin (.ehpk)
  apps/ios/             iPhone + Apple Watch apps (SwiftUI, XcodeGen) + FitLoopKit (models, API, sign-in, reminders)
  scripts/              integration test, simulator e2e, TestFlight release
  branding/             icon source
  docs/                 decisions, deployment, the docs page
supabase/schemas/fitloop/   the `fitloop` schema (repo root)
```
