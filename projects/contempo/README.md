# Contempo

> Part of the [HEJI apps monorepo](https://github.com/tianhaoz95/hejitech-apps) (`projects/contempo`). Since 2026-10-16 the backend is the shared Supabase project (schema `contempo`) plus the Contempo Cloudflare Worker (`services/web`), not Firebase; see `CLAUDE.md`. Live: https://contempo.hejitech.workers.dev

An AI-native short-term rental (STR) "material participation" hour tracker —
helping STR hosts and real estate professionals log hours in a way that
survives an IRS audit (contemporaneous records for the 100-hour / 500-hour STR
tests or the REPS 750-hour test). "Contempo" is a working brand name, not a
final naming decision.

Ships under the **Hejitech** business entity — every app/bundle identifier
follows `com.hejitech.<app>` (with a couple of documented exceptions in
`CLAUDE.md`). The real Firebase project backing every platform is
**`contempo-str`**.

## Repo layout

| Path | What it is |
| --- | --- |
| `android/` | The MVP app — Kotlin/Compose, Gradle multi-module (`app` phone, `core` shared, `wear` Wear OS companion). No README yet; see `CLAUDE.md`'s "`android/` architecture" section. |
| `ios/` | iOS + watchOS app (SwiftUI, XcodeGen). Parity with `android/`. See [`ios/README.md`](ios/README.md). |
| `backend/` | The Firebase project root — Firestore, Auth, Storage, Cloud Functions (Genkit). See [`backend/README.md`](backend/README.md). |
| `web/` | Vite/React/TypeScript. Billing/subscriptions live **only** here (never in the mobile apps, to avoid Apple/Google's IAP fee), plus a dashboard and legal pages. See [`web/README.md`](web/README.md). |
| `services/admin/` | Internal admin site — coupon management, restricted to admin accounts. See [`services/admin/README.md`](services/admin/README.md). |
| `feedback/` | Standalone, login-free feedback form — zero-dependency static site, forwarded to FeedbackKit. See [`feedback/README.md`](feedback/README.md). |
| `reports/` | Planning docs (PRD, MVP scope, implementation status) as a small static site. |
| `branding/landing_v0/` | Landing-page mockup used to pressure-test positioning before any product existed. |
| `scripts/` | Dev-loop, build, and release scripts — see below. |

## Getting started

Most day-to-day work happens in `android/`, `ios/`, or `backend/`. The
fastest local dev loop runs the Firebase emulator suite alongside the app so
nothing touches the real `contempo-str` project:

```bash
./scripts/run-android-with-emulators.sh   # Android + emulators, torn down together on Ctrl+C
./scripts/run-ios-with-emulators.sh       # iOS + watchOS + emulators
```

Static sites (`reports/`, `branding/landing_v0/`, `feedback/`) need no build
step — just a local server:

```bash
./scripts/serve-reports.sh
./branding/landing_v0/script/serve.sh
./scripts/serve-feedback.sh
```

Shipping a build to TestFlight / Play Console:

```bash
scripts/cut_release.sh contempo --dry-run   # from the monorepo root; then without --dry-run
cd android && ./gradlew :app:publishReleaseBundle   # Android: bump versionCode in app/build.gradle.kts first
```

`cut_release.sh contempo` bumps `MARKETING_VERSION` in `ios/project.yml` and publishes
`contempo-v<version>`, which runs `contempo-testflight.yml` (`scripts/release_testflight.sh`:
fetches the bundled model, signs with the team's identities, UTC build numbers).
`NO_UPLOAD=1 APPLE_TEAM_ID=68CTFST8W2 scripts/release_testflight.sh` checks the archive and
export locally without uploading.

## Full details

`CLAUDE.md` (symlinked as `AGENTS.md`/`CODEX.md` for AI coding agents) is the
authoritative, continuously-updated reference for this repo — architecture
decisions, the real Firebase project's setup, per-platform build/release
mechanics, and product context. Read it before making non-trivial changes;
it documents *why*, not just *what*, and many of the more surprising design
choices in this codebase exist for reasons captured there and nowhere else.
