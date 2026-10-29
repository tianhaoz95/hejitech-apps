# CLAUDE.md

Guidance for working on Waypack, one project in the HEJI monorepo. Read the root `CLAUDE.md` too
(releases, the shared Supabase project, the graduation rules). Paths below are relative to
`projects/waypack/` unless they start at the repo root.

Waypack turns an AI agent into a travel planner whose output works fully offline: the agent (with
the Waypack skill and MCP server) publishes a **trip bundle** (a self-contained mobile web app plus
`manifest.json`), the backend or the phone cuts an offline vector map of the trip area, and the
Flutter app downloads both. `docs/design.md` is the design, `docs/DECISIONS.md` records every
deviation and owner decision (#1–#71): read it before proposing architectural changes and don't
reopen decided options (see "Decided" below). `docs/DEPLOY.md` is setup, secrets and recovery.

## Commands

```bash
npm install && npm run build:waypack          # from the repo root: schema, trip SDK, CLI
(cd ../.. && supabase start)                  # shared stack, ports 554xx
cp services/mcp/.dev.vars.example services/mcp/.dev.vars   # keys from `supabase status`
(cd services/mcp && npm run dev)              # Worker on http://127.0.0.1:8787: site · /account · /mcp
(cd services/mcp && npx wrangler dev --var MAP_EXTRACTS:device)   # no tiler container needed

npm run test:waypack && npm run typecheck:waypack       # packages + Worker unit tests
MAP_EXTRACTS=device node services/mcp/scripts/e2e.mjs   # 65 end-to-end checks against the running stack
node services/mcp/scripts/e2e-{preview,revise,shares,companions,preview-browser}.mjs
node services/mcp/scripts/seed-dev.mjs you@example.com  # Pro account + the Sequoia example trip

cd apps/mobile && flutter test test/                     # app unit tests
flutter test integration_test/app_test.dart -d <device> --dart-define=DEV_SIGN_IN=true --dart-define=NO_PERMISSION_PROMPTS=true
node apps/mobile/tool/screenshots.mjs <sim-udid|macos> <out>   # walkthrough + smoke test

node packages/cli/dist/cli.js init|preview|validate ./my-trip  # bundles without the backend
scripts/db_migration.sh waypack <what>        # repo root, after editing supabase/schemas/waypack/
```

Local sign-in: the dev sign-in (any email) on the portal and the agent sign-in page, local servers
only; the app needs `--dart-define=DEV_SIGN_IN=true`. App Review's demo account (#71): locally
`review@example.com` / `waypack-review-dev` (wrangler.jsonc vars; `seed-dev.mjs review@example.com
--review waypack-review-dev` gives it the example trip); production via `scripts/review_account.sh
waypack` (`review.env`, skill heji-review-account). App flags: `--dart-define=REVIEW_SIGN_IN="<email>
<password>"` signs in through it at launch, `--dart-define=EMAIL_SHEET=true` opens its sheet.

## Architecture

- **`services/mcp`** is one Cloudflare Worker for everything server-side: the hand-written stateless
  MCP JSON-RPC server (26 tools, `src/mcp/tools.ts`), its own OAuth 2.1 server
  (`@cloudflare/workers-oauth-provider`; `wpk_…` personal tokens as fallback), uploads and downloads,
  live previews (served from a separate origin, `PREVIEW_URL`), shared trips and the gallery, Stripe
  billing (`/stripe/webhook`), crons, and the static site/portal in `site/`.
- **Database:** the `waypack` schema of the shared Supabase project (`supabase/schemas/waypack/` is
  the source; it lived in `public` until 2026-10-16). The Worker talks to PostgREST through
  `src/lib/db.ts` with the service key and `Accept-Profile`/`Content-Profile: waypack`; the apps
  use Supabase only for sign-in. Files (bundles, uploads, previews, extracts) are in the `waypack`
  Storage bucket via `src/lib/bucket.ts`. Rows per user are created on first use (no sign-up trigger;
  a missing entitlement is the free plan).
- **Maps:** production runs `MAP_EXTRACTS=device`: the app cuts PMTiles for the trip area straight
  from the public planet build with range requests. `services/tiler` (Go + pmtiles, Cloudflare
  Containers) is the server-side alternative, kept but not running.
- **Bundles:** `packages/bundle-schema` (manifest v1 JSON Schema + validator, used by the CLI, the
  Worker and browsers), `packages/trip-sdk` (`window.Waypack`: MapLibre + PMTiles + offline glyphs +
  the native bridge), `packages/cli` (`@waypack/cli`), `skill/` (what agents follow to author trips).
- **App** (`apps/mobile`, Flutter, iOS/Android/macOS): a free viewer. Resumable downloads with
  SHA-256 checks, a 127.0.0.1 server (token gate, CSP, Range, DNS-rebinding guard) feeding a
  WebView, native Today and offline Map, companions, offline QR/LAN handoff, and an on-device trip
  assistant (`lib/assistant/`). See `apps/mobile/README.md`.

Generated, never edit by hand: `services/mcp/src/generated/guide.ts` (from `skill/`, run
`node services/mcp/scripts/gen-guide.mjs`), `site/__waypack/` (from the built SDK) and
`apps/mobile/assets/sdk.zip` (`node apps/mobile/tool/bundle_sdk.mjs`).

## Decided (owner decisions; don't reopen without the owner)

- Sign-in is **Google or Apple only**: no email/password or codes for people (#29); dev sign-in only on
  local servers (#30). The one exception is App Review's demo account (#71): "Sign in with email"
  works only for accounts Waypack hands out, and that account is Pro.
- **Billing is on the web with Stripe; the apps are free viewers** with no purchase UI or calls to
  action (App Store 3.1.3(f), #25). Offline maps are Pro-only, with no per-account exceptions besides the review account (#71).
- **No paid Cloudflare Containers until there are paying users**: device maps in production (#54).
- Files in Supabase Storage, not R2 (#56). Mac DMGs are GitHub release assets (#57) and the Mac app
  updates with Sparkle from `releases/latest` (#65), so **Waypack is the only project with
  `LATEST=true`**.
- The trip assistant runs on-device only (#49); small-model grounding is done in Dart (#50).

## Pitfalls

- Don't launch a Developer-ID (release) Mac build on the development Mac casually: macOS asks
  "differs from previously opened versions", and debug runs and `flutter test -d macos` wait on it.
- On-device model evaluations write multi-GB caches next to the model: check free disk space first,
  run one model at a time, delete models afterwards (`apps/mobile/tool/assistant_eval`).
- Clean up `apps/mobile/build/{ios,macos,app}` after large builds.
- New tables belong in `supabase/schemas/waypack/` with explicit grants (a custom schema gets no
  Supabase defaults); `scripts/graduation_check.sh waypack` must keep passing.

## Releasing

`scripts/cut_release.sh waypack` from the repo root (settings: `release.env`): bumps
`apps/mobile/pubspec.yaml`, pushes (Cloudflare Workers Builds deploys the Worker and site), and
publishes `waypack-v<version>`, which runs `waypack-testflight.yml` (iOS) and
`waypack-mac-release.yml` (notarized `Waypack.dmg` + Sparkle appcast). Build numbers are
2000 + run number. Release builds read `WAYPACK_SUPABASE_URL`, `WAYPACK_SUPABASE_ANON_KEY` and
`WAYPACK_API_URL` (GitHub variables). Local tools: `apps/mobile/tool/release_ios.sh`,
`release_mac.sh`, but releases go through the script.
