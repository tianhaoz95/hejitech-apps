# Contempo

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
| `admin/` | Internal admin site — coupon management and feedback triage, restricted to admin accounts. See [`admin/README.md`](admin/README.md). |
| `feedback/` | Standalone, login-free feedback form — zero-dependency static site. See [`feedback/README.md`](feedback/README.md). |
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

Shipping a build to Play Console / TestFlight goes through:

```bash
cd android && ./gradlew :app:publishReleaseBundle   # bump versionCode in app/build.gradle.kts first
./scripts/ship-ios-testflight.sh
```

**Always stop the Firebase emulator suite when you're done with it** — a
leftover instance silently occupies ports 8080/9099/9199/5001/4400/4500 and
blocks the next run.

## Full details

`CLAUDE.md` (symlinked as `AGENTS.md`/`CODEX.md` for AI coding agents) is the
authoritative, continuously-updated reference for this repo — architecture
decisions, the real Firebase project's setup, per-platform build/release
mechanics, and product context. Read it before making non-trivial changes;
it documents *why*, not just *what*, and many of the more surprising design
choices in this codebase exist for reasons captured there and nowhere else.
