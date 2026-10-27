# Headway

Caltrain status on Even G2 glasses, steered with the R1 ring, with iPhone alerts for delays,
cancellations, leaving on time and arriving at your stop. Docs:
<https://tianhaoz95.github.io/hejitech-apps/headway/>. Working on it: [`CLAUDE.md`](CLAUDE.md).

```
projects/headway/
  packages/core/        @headway/core: compiled Caltrain timetable, GTFS-RT reader, boards, settings,
                        alert engine, G2 screens + R1 state machine (TypeScript, consumed as source)
  services/web/         @headway/web: Cloudflare Worker (site, /api, every-minute cron, APNs, /mcp + OAuth)
  apps/glasses/         @headway/glasses: Even Hub plugin (.ehpk)
  apps/ios/             iPhone app (SwiftUI, XcodeGen) + HeadwayKit (models, API client, sign-in)
  apps/android/         Android & Wear OS companion apps:
                          app/    Phone app (Jetpack Compose Material 3)
                          wear/   Wear OS watch app (Wear Compose, Tile & Complication)
                          core/   Shared Kotlin models, API client & Wearable sync
  scripts/              timetable compiler, integration test, simulator e2e, TestFlight release
  branding/             icon source
  docs/                 decisions, deployment, the docs page
supabase/schemas/headway/   the `headway` schema (repo root)
```
