# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

An AI-native short-term rental (STR) "material participation" hour tracker — a
mobile-first app that helps STR hosts and real estate professionals log hours in
a way that survives an IRS audit (contemporaneous records for the 100-hour /
500-hour STR tests or the REPS 750-hour test). Part of the HEJI monorepo
(`projects/contempo` of `tianhaoz95/hejitech-apps`, imported 2026-10-16 from the private
`tianhaoz95/contempo`); the root `CLAUDE.md` has the shared rules.

- `android/` — the MVP app (Kotlin/Compose, Gradle multi-module: `app`, `core`, `wear`).
- `ios/` — the iOS + watchOS app (SwiftUI, XcodeGen: `Contempo`, `Contempo Watch App`,
  `ContempoWidgets`, `Contempo Watch Widgets`, and the `ContempoCore` package with the
  `ContempoCore` + `ContempoData` libraries). Parity with `android/`.
- `services/web/` — the Contempo **Cloudflare Worker** (`contempo`,
  https://contempo.hejitech.workers.dev): serves the web app (Vite/React: Dashboard, Entries,
  Settings, Billing, legal pages `/legal/privacy` and `/legal/terms`), the admin site at
  `/admin/` (`services/admin/`, feedback triage + coupons, admins only), the login-free feedback
  form at `/feedback/` (`feedback/public/`), and the API that replaced the Firebase Cloud
  Functions (`src/worker/index.ts`).
- `reports/`, `branding/landing_v0/` — zero-dependency static planning/branding sites.

**Backend: the shared HEJI Supabase project, schema `contempo`** (moved off Firebase project
`contempo-str` on 2026-10-16; no users were migrated). `backend.env` says `BACKEND=shared` and
lists the only files allowed to hold the project's URL/key. Rules for schema changes:
`supabase/README.md` at the repo root.

- **Schema:** `supabase/schemas/contempo/schema.sql` (declarative; migrations via
  `scripts/db_migration.sh contempo <what>` at the repo root). Tables mirror the old Firestore
  collections, one owner per row (`user_id`, RLS ownership-only): `properties`, `roles`,
  `categories`, `entries`, `attachments` (immutable except `note`), `corrections`
  (append-only), `audio_captures` / `text_captures` (background queues), `token_usage`
  (`device` rows via `record_device_token_usage`, `cloud` rows only from the Worker),
  `app_feedback` (shake to report; admins triage), `feedback` (anonymous form; admins read),
  `subscriptions` / `stripe_customers` (Worker's Stripe webhook only), `admins` (who may use
  `/admin/`; add rows by hand). The Firestore rules' field validation became check
  constraints. Rows go with the auth user (`on delete cascade`).
- **Storage:** private bucket `contempo`, every object under `<uid>/…` (`entries/<id>/…`,
  `audio/…`, `feedback/<id>/screenshot.jpg`); clients store long-lived signed URLs on rows
  (`photo_urls`, `download_url`, `audio_url`) where Firestore stored download URLs.
- **Auth:** Supabase Auth, Google only, the monorepo's way: a browser tab to Supabase's
  `/authorize` (PKCE) returning to `com.hejitech.contempoapp://login-callback` (Android,
  iOS) or the page itself (web). No Google SDKs or client ids in the apps. The watch signs in
  with a one-time pairing code from the phone (`POST /api/watch/pair` → `verifyOTP` with the
  token hash), replacing the Firebase custom token.
- **AI is on-device only** (product decision 2026-10-16; no cloud inference anywhere), the
  Voxbrief way: a small model ships with the app and works offline from first launch
  (Qwen3-0.6B no-think Q4 for LiteRT-LM, ~347 MB: Android install-time asset pack `:qwen_model`,
  copied once to a file; iOS bundle resource). It isn't in git (GitHub's file limit): run
  `scripts/fetch-models.sh` before building. The larger Gemma model (~2.6 GB, multimodal) is an
  opt-in download from Settings and takes over once present; it's the only tier that reads
  photos. The small model is prompted for JSON and its fields are cross-checked by
  `RuleBasedEntryParser.refineSmallModelDraft` (stated durations/miles and known property names
  win, timer intent from `TimerIntentClassifier`, dates dropped); `RuleBasedEntryParser.parse` is
  the fallback when no model can run (`ParseSource.RULES`). Both engines get `maxNumTokens = 1280`
  and a writable cache dir; without those iOS killed the app at 2.2 GB. `ContempoTests/
  BundledModelTests` runs the real model on the attached iPhone. Plain `installRelease` APKs
  don't contain Play asset packs (Whisper's included), so sideloaded Android builds parse with
  the rule-based fallback; Play installs get the model.
- **Worker API** (`services/web/src/worker/index.ts`, bearer = Supabase access token):
  `flag-risk`, `account/delete`, `watch/pair`,
  `billing/checkout` / `billing/portal` / `stripe/webhook` / `admin/coupons/*` (Stripe over
  fetch; needs `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`), and `feedback` (anonymous).
  Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (the shared HEJI Stripe account's
  key) and `STRIPE_WEBHOOK_SECRET` (endpoint `we_1URNe…`, see `~/Credentials/stripe.env`).
  Contempo Pro is product `prod_V0smC72BLmnFUb`; the webhook ignores other apps' subscriptions.
  Billing stays even though Pro no longer unlocks cloud AI (what Pro sells is open).
- **Clients:** Android `core/.../supabase/ContempoBackend.kt` (supabase-kt 3.6; live lists =
  select + Realtime reload) and `SupabaseEntryRepository`; iOS
  `ContempoCore/.../Data/ContempoBackend.swift` (supabase-swift) and `ContempoData`'s
  `SupabaseEntryRepository`; web/admin `src/lib/supabase.ts`. Models keep a `Timestamp` type with
  Firebase's API (a drop-in in `core`/`ContempoCore`), so screens didn't change.
- **Deploy:** the Worker deploys from the repo with `npm run deploy -w @contempo/web` (Workers
  Builds can run the same on push). `.github/workflows/contempo-ci.yml` typechecks, tests and
  builds it.
- **Package names:** Android `applicationId` is `com.hejitech.contempoapp` (Play Console locked
  it; Gradle `namespace` stays `com.hejitech.contempo`), Wear `com.hejitech.contempoappwear`,
  iOS `com.hejitech.contempoapp`. Don't "fix" them.
- **Signing keys:** the Android upload keystores and `keystore.properties` are **not** in git
  (this repo is public; they were stripped from the imported history). They live in
  `~/Credentials/contempo/`; copy them into `android/` for local release builds.

## Commands

```bash
# Serve the planning-docs site (reports/) — defaults to :8420, opens the browser
./scripts/serve-reports.sh
./scripts/serve-reports.sh 9000   # custom port

# Serve the landing page mockup (branding/landing_v0/site/) — defaults to :8430
./branding/landing_v0/script/serve.sh
./branding/landing_v0/script/serve.sh 9000

# Build/install the Android app
cd android && ./gradlew :app:assembleDebug   # or :app:installDebug with a device attached

# Web app + Worker (from the repo root): typecheck, tests, local Worker against the local
# Supabase stack (`supabase start` first), deploy
npm run typecheck -w @contempo/web && npm test -w @contempo/web
npm run dev:worker -w @contempo/web      # http://127.0.0.1:8789 (needs services/web/.dev.vars)
npm run deploy -w @contempo/web

# Triage shake-to-report feedback (needs SUPABASE_SECRET_KEY in the environment)
node scripts/fetch-feedback.mjs

# Launch Android and Wear OS emulators (AVDs)
./scripts/launch-android-emulators.sh                       # Launch Android phone & Wear OS AVDs
./scripts/launch-android-emulators.sh --phone               # Launch phone AVD only
./scripts/launch-android-emulators.sh --wear                # Launch Wear OS AVD only

# Build & install production/release builds (hosted Supabase):
./scripts/install-android-prod.sh                           # Android + Wear OS
./scripts/install-ios-prod.sh                               # iOS + watchOS


# Ship a new Android build to the Play Console internal testing track
# (bump versionCode in android/app/build.gradle.kts first — see "Play Store
# publishing" below for one-time setup and caveats).
cd android && ./gradlew :app:publishReleaseBundle
```

**Task Completion Rule**: Upon completing code changes or any task, always run both production build scripts to verify there are no compilation or build regressions:
```bash
./scripts/install-android-prod.sh
./scripts/install-ios-prod.sh --no-launch
```
*Note*: It is acceptable if installation fails due to no connected device/simulator, but any build, compilation, script, or configuration error must be debugged and fixed before considering the task complete.

Both static-site scripts just `cd` into the relevant site directory and run
`python3 -m http.server`; there's nothing to install first. Requires `python3` on
PATH. After editing HTML/CSS/JS in `reports/` or `branding/`, a quick sanity
check worth running before calling something done (no formal test suite for
those two, so this is the substitute):

```bash
# tag-balance check (adjust the tag list / file as needed)
python3 - <<'EOF'
import re
html = open("path/to/file.html").read()
for t in ["div","section","span"]:
    o = len(re.findall(r"<%s[ >]" % t, html))
    c = len(re.findall(r"</%s>" % t, html))
    print(t, o, c, "OK" if o == c else "MISMATCH")
EOF

# JS syntax check
node --check path/to/file.js
```

## `reports/` architecture

- `reports/index.html` is a hand-maintained home page — a card grid linking to
  each report. Adding a new report means adding both the report HTML file *and*
  a card here; nothing is auto-discovered.
- Every report page (`prd-v0.html`, `mvp-scope-v0.html`, ...) shares
  `reports/assets/style.css` (light theme only — this site is explicitly
  light-themed, unlike the landing page) and `reports/assets/toc.js`.
- **The sidebar table of contents is auto-generated**: `toc.js` scans the page's
  `.report-content` for `h2`/`h3` elements, assigns them slugged `id`s, and builds
  the nav list with scroll-spy highlighting. This means: to add a navigable
  section to a report, just add an `<h2>`/`<h3>` — never hand-edit a TOC.
- Report pages follow a consistent shell: `.report-shell` (grid: `.toc-col` +
  `.report-main`), a `.report-header` with an eyebrow/title/`.doc-meta` line, then
  `.report-content` with the actual sections. Reuse `.callout` (and
  `.callout.warn` / `.callout.risk`) for pull-quotes and `.table-wrap > table` for
  any tabular content — these are the only styled block components available;
  don't invent new one-off classes for things a callout or table already covers.

## `branding/landing_v0/site/` architecture

A single-page landing site (`index.html` + `assets/style.css` + `assets/script.js`
+ `assets/i18n.js`), fully self-contained — no image assets, no font/CDN
dependencies. A few systems to understand before editing:

**Design tokens & themes.** Colors live as CSS custom properties on `:root`
(pine/navy/brass palette on a cool paper ground), redefined under
`@media (prefers-color-scheme: dark)` and again under `:root[data-theme="dark"]` /
`:root[data-theme="light"]` so the explicit toggle (top-right ◐/○ button) can
override the OS preference in either direction. Device chrome (phone/watch
bezels) intentionally uses separate, theme-*independent* tokens
(`--device-bezel`, `--device-screen-dark`) — a phone mockup shouldn't relight when
the page theme changes, real device bezels don't.

**i18n.** All user-facing copy is tagged `data-i18n="key"` (or
`data-i18n-placeholder` for input placeholders) and resolved at runtime by
`assets/i18n.js` against an `en`/`zh` dictionary object, toggled via the
中文/EN button and persisted to `localStorage`. **The two language dictionaries
must stay in exact key parity** — when adding new copy, add both languages at
once. To verify parity after an edit:

```bash
cd branding/landing_v0/site && python3 - <<'EOF'
import re
html = open("index.html").read()
js = open("assets/i18n.js").read()
used = set(re.findall(r'data-i18n(?:-placeholder)?="([^"]+)"', html))
en = set(re.findall(r'"([a-zA-Z0-9_.]+)":', js.split('en: {')[1].split('\n    },')[0]))
zh = set(re.findall(r'"([a-zA-Z0-9_.]+)":', js.split('zh: {')[1].split('\n    }')[0]))
print("used-not-in-en:", used - en)
print("used-not-in-zh:", used - zh)
print("en-zh mismatch:", en ^ zh)
EOF
```

Anything CSS-generates as `content:` (e.g. a badge) can't be picked up by
`data-i18n` — if copy needs to be translatable, it must be real DOM text, not a
`::before`/`::after` `content` string.

**Device mockups are pure CSS, no images.** `.device-phone` / `.device-watch` /
`.mini-device` (a smaller variant used in the "capture trio") render bezels,
notches, and screens entirely from CSS shapes. Watches get a wrist band via a
separate `.watch-mount` wrapper (`.watch-band-top` / `.watch-band-bottom`, plus a
`.watch-band-mini` modifier for the compact variant) — the case and the band are
siblings, not one shape, so they can be styled/animated independently.

**Scroll-triggered animation system**, all driven by one `IntersectionObserver` in
`script.js`: any element with class `.reveal` gets `.in-view` added once it
scrolls into view (and is then unobserved — animations play once, never loop on
re-scroll). Descendant elements use `.pop-in` (a generic fade/slide-up utility,
customizable via the `--pop-y` custom property) with an inline
`style="animation-delay:Xs"` to stage a sequence relative to the parent's
`.in-view` moment. **Gotcha:** if an element needs two different animations (e.g.
a pop-in entrance *and* a pulse), giving it two classes that each set the
`animation` shorthand will silently cancel one — see how `.tap-confirm` and
`.pop-in.glow-once` combine both animation names into a single rule instead.

**Content/tone constraints worth preserving:** no fabricated testimonials or
invented usage numbers anywhere on this page (there's no real product or users
yet — copy leans on sourced claims: IRS Pub 925 / §1.469-5T contemporaneity
requirements, Tax Court precedent, real competitor feature gaps). Pricing tiers
and the brand name are explicitly placeholder/illustrative, flagged as such
elsewhere — don't harden them into fact without being asked.

## `android/` architecture

Gradle multi-module (Kotlin, Jetpack Compose, version catalog in
`gradle/libs.versions.toml`): `app` (the phone MVP), `core` (shared domain
models + repository interfaces, e.g. `EntryRepository` /
`SupabaseEntryRepository` in `core/src/main/java/com/hejitech/core/`, and the Supabase client in
`core/.../supabase/`), `wear`
(Wear OS companion — voice capture relayed to the phone for processing, plus
a progress Tile and an hours Complication; see its `capture`/`tile`/
`complication` packages and its own instrumented test suite,
`wear/src/androidTest/`).

- **`android/local.properties`** is gitignored (`sdk.dir`; optionally `SUPABASE_URL` /
  `SUPABASE_PUBLISHABLE_KEY` to point a build at another Supabase project, e.g. the local stack via
  `adb reverse`). Builds default to the hosted project from `app/build.gradle.kts`. A JDK 17
  (`JAVA_HOME=/opt/homebrew/opt/openjdk@17/...`) runs this Gradle; Android Studio's bundled JDK 25
  is too new for Gradle 8.11.
- **Play Store publishing is automated via `gradle-play-publisher`**
  (`com.github.triplet.play`, pinned to `3.13.0` in `gradle/libs.versions.toml`
  — not the `4.0.0` latest, which requires Gradle 9.1+ and this project is on
  Gradle 8.11.1/AGP 8.7.2), applied and configured in `android/app/build.gradle.kts`'s
  `play { }` block (`defaultToAppBundles = true`, `track = "internal"`).
  To ship a new build: **bump `versionCode`** in that file (Play rejects
  re-uploading a code that's already been used, including for internal
  testing), then from `android/`: `./gradlew :app:publishReleaseBundle`. This
  builds, signs (with `android/upload-keystore.jks`), uploads, and commits the
  release to the `internal` track in one step — no Play Console UI needed.
  - Auth: `credentials/play-publisher-service-account.json` (gitignored —
    `credentials/` is entirely git-ignored, unlike the release signing
    keystore in `android/`, which is deliberately committed; this key is far
    higher blast-radius since it can push a release straight to production,
    not just sign a build) is a GCP service account key,
    `play-store-deploy@contempo-str.iam.gserviceaccount.com`, granted
    Play Console API access (Setup → API access) to the app.
  - The Google Play Android Developer API
    (`androidpublisher.googleapis.com`) must be enabled on the
    `contempo-str` GCP project for this to work
    (`gcloud services enable androidpublisher.googleapis.com --project
    contempo-str`) — it's not on by default even after granting the
    service account Play Console permissions, and the first automated publish
    attempt failed on exactly this until it was enabled.
  - The Play Console listing's package name is **`com.hejitech.contempoapp`**,
    not `com.hejitech.contempo` — see "Package names" above. `applicationId` in
    `app/build.gradle.kts` is set accordingly; don't "fix" it back to match
    the `com.hejitech.<app>` convention, that would break publishing.
  - The very first Play release still had to be a manual upload through the
    Play Console web UI (Play App Signing enrollment + initial store listing
    can't be done via the API) — this automation is for every release
    *after* that first one.
- **Sign-in** (`auth/AuthManager.kt`) opens Supabase's Google sign-in in a browser tab; the
  `com.hejitech.contempoapp://login-callback` deep link (manifest intent filter) goes to
  `ContempoBackend.client.handleDeeplinks` in `MainActivity`, and `AuthGate` follows
  `ContempoBackend.signedIn`. supabase-kt is pinned to 3.6 (3.7+ needs Kotlin 2.4), and
  `androidx.browser` is forced to 1.8.0 in the root `build.gradle.kts` (1.10 needs AGP 8.9.1+).
- No crash/performance SDKs: `data/PerformanceTrace.kt` logs timings to logcat (tag
  `ContempoTrace`) with the old call-site API. Account deletion and watch pairing call the Worker
  (`ContempoBackend.api`); AI is on-device only (`agent/LiteRtLlm.kt`, see above).
- **`data/AuthAwareFlow.kt`'s `recoverFromAuthRaceOrSignOut()`** is the
  standard way every eagerly-collected live query (Capture/Dashboard/
  Confirm ViewModels) handles a 401/403 from Supabase — retries
  once after a short delay (a real, confirmed-live token-propagation race on
  fresh sign-in, not just an emulator quirk) before falling back to sign-out.
  Use this rather than a bespoke `.catch` block for any new eagerly-collected
  listener.
- Persistent "work in progress" / "trip in progress" notifications
  (`timer/OngoingWorkNotificationService.kt`, `mileage/MileageTrackingService.kt`)
  use `IMPORTANCE_DEFAULT` channels, not `IMPORTANCE_LOW` — confirmed live
  that at least one OEM (ColorOS) treats `IMPORTANCE_LOW` as "silent" and
  buries the notification below every other app's, defeating an
  ongoing-status notification's entire purpose.
- Instrumented tests that ran against the Firebase emulator were removed with the move; rewriting
  them against the local Supabase stack is open work. `wear/.../WearCaptureScreenUiTest.kt` was
  already out of date with the screen's signature before the move.

## Product context worth knowing before writing more planning content

Full detail lives in `reports/prd-v0.html` and `reports/mvp-scope-v0.html`
(original planning), `reports/prd-status-v0.html` and
`reports/mvp-implementation-v0.html` (what's actually built vs. planned —
check these before assuming a planning doc still reflects current state),
`reports/web-implementation-v0.html`, and `reports/play-store-listing-v0.html`
(release-readiness tracking — note some of its content drifts stale quickly,
e.g. it may still describe a gap as open after that gap's actually been
closed by later work; verify live rather than trusting it outright). All are
linked from `reports/index.html`'s card grid. The load-bearing facts:

- Four real competitors were researched: REPSLog, HourProof, STR Loophole
  (strhours.com — the funded/multi-product one to watch), and Field Ledger.
- Core product wedge: fuse passive signals beyond booking-platform sync
  (location, bank, smart locks, photos) into AI-parsed, contemporaneity-scored,
  audit-defense records — captured hands-free, with a legal-grounding copilot
  none of the four competitors actually build (only market).
- **MVP platform order is Android first, iOS fast-follow** — decided because the
  first real pilot user is an Android host, not from a demographic assumption.
  PMS/Airbnb integration, geofencing, and bank-signal capture are explicitly *out*
  of MVP scope (they're competitive-parity plays, not tests of the actual
  hypothesis that frictionless capture changes logging behavior).
- **The business entity this product ships under is Hejitech.** Every platform's
  app/bundle identifier follows `com.hejitech.<app>` — e.g. the Android phone app
  is `com.hejitech.contempo` (Gradle `namespace`; the actual `applicationId` is
  `com.hejitech.contempoapp`, see the Play Console exception above). The Wear OS
  app deviates further, as `com.hejitech.contempoappwear` rather than plain
  `com.hejitech.wear` — Hejitech ships more than one product, so the Wear
  companion's package name needs to say which product it belongs to, not just
  that it's *a* Wear app. Apply the same disambiguation when iOS (`ios/`) or web
  (`web/`) code actually starts (iOS bundle ID, web package namespace, etc.) —
  `com.hejitech.<platform-or-app-name>`, not `com.contempo.*`.
