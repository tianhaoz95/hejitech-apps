# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

An AI-native short-term rental (STR) "material participation" hour tracker — a
mobile-first app that helps STR hosts and real estate professionals log hours in
a way that survives an IRS audit (contemporaneous records for the 100-hour /
500-hour STR tests or the REPS 750-hour test). Product code now exists — the MVP
Android app and its Firebase backend are underway, alongside the original
planning/branding artifacts:

- `reports/` — a small internal site of planning documents (PRD, MVP scope), each
  a standalone HTML file with an auto-generated table of contents.
- `branding/landing_v0/` — a landing-page mockup for the product concept (working
  brand name **"Contempo"**, a placeholder — not a final naming decision), used to
  pressure-test positioning and feel before any product is built.
- `android/` — the MVP app (Kotlin/Compose, Gradle multi-module: `app`, `core`,
  `wear`). See "`android/` architecture" below.
- `backend/` — the Firebase project root (Firestore, Auth, Storage, Genkit Cloud
  Functions). See "`backend/` architecture" below.
- `ios/` — the iOS + watchOS app (SwiftUI, XcodeGen multi-module: `Contempo` phone app, `Contempo Watch App`, `ContempoWidgets`, `Contempo Watch Widgets`, and `ContempoCore` package). Parity with `android/` and `android/wear/`. See `ios/README.md`.
- `web/` — Vite/React/TypeScript (see `web/README.md`), not MVP (never
  day-to-day capture) but no longer just a scaffold: real Dashboard/Entries/
  Settings/Billing/Sign-in pages, working account deletion (calls the same
  `deleteAccount` Cloud Function as Android), and legal pages
  (`/legal/privacy`, `/legal/terms`) live and reachable signed-out (Play Store
  review requires this). Auto-deployed to Firebase Hosting (site `contempo`,
  `https://contempo.web.app`) via `.github/workflows/firebase-deploy.yml`'s
  `deploy-hosting` job on every push to `main`. **Subscriptions are web-only
  by design**: neither the Android nor iOS app will ever contain a purchase
  flow or pricing mention, specifically to avoid Apple/Google's
  in-app-purchase platform fee — the apps only read entitlement status
  (synced from Stripe into Firestore, via Stripe's official Firebase
  Extension) and gate premium features accordingly. Stripe itself isn't wired
  up yet (`web/src/billing/subscription.ts` has a `TODO(stripe)`) — the
  Billing page is UI without a working purchase flow behind it yet; Auth
  (Google Sign-In) and Firestore are wired against the real `contempo-platform`
  project, same as `android/`.
- `feedback/` — a standalone, login-free feedback form (see
  `feedback/README.md`), zero-dependency static site like `reports/` and
  `branding/landing_v0/`. Writes anonymously to a top-level `feedback`
  Firestore collection via its own Firebase Web App registration ("Contempo
  Feedback", separate from `web/`'s "Contempo Web" app, though same
  `contempo-platform` project) and its own Hosting site (`contempo-feedback`,
  `https://contempo-feedback.web.app`) — entirely separate from the main
  `contempo` Hosting site `web/` deploys to.

The **real Firebase project is `contempo-platform`** (project number
`646737053318`), backing `android/`, `backend/`, `web/`, and eventually `ios/` —
all under the **Hejitech** business entity (`com.hejitech.<app>` package/bundle
IDs — e.g. `com.hejitech.contempo` for the Android phone app, `com.hejitech.wear`
for Wear OS — not `com.contempo.*`). It has Firestore (standard edition,
`us-central1`, chosen over multi-region `nam5` to stay cheap pre-revenue —
identical free-tier quota either way, but `nam5` costs more once billed and buys
reliability this single-pilot-user MVP doesn't need yet) and Google Sign-In
enabled. An Android app (`com.hejitech.contempo`) is registered in it with debug
keystore SHA-1/SHA-256 fingerprints attached for real (non-emulator) Google
Sign-In. `reports/` and `branding/landing_v0/` remain zero-dependency static
sites — no backend, no build tooling — served locally via plain
`python3 -m http.server` wrapper scripts; don't introduce a bundler/framework
there without a reason.

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

# Full local dev loop: Firebase emulators + build + install, torn down together on Ctrl+C.
./scripts/run-android-with-emulators.sh                    # Android against demo-contempo
./scripts/run-android-with-emulators.sh contempo-platform  # Android against real project
./scripts/run-ios-with-emulators.sh                        # iOS + watchOS against demo-contempo

# Launch Android and Wear OS emulators (AVDs)
./scripts/launch-android-emulators.sh                       # Launch Android phone & Wear OS AVDs
./scripts/launch-android-emulators.sh --phone               # Launch phone AVD only
./scripts/launch-android-emulators.sh --wear                # Launch Wear OS AVD only

# Build & install production/release builds (real Firebase contempo-platform, no emulators):
./scripts/install-android-prod.sh                           # Android + Wear OS
./scripts/install-ios-prod.sh                               # iOS + watchOS

# Firebase CLI commands (run from backend/, or pass --project) always prefer
# `npx -y firebase-tools@latest ...` over a global `firebase` install.
```

**Task Completion Rule**: Upon completing code changes or any task, always run both production build scripts to verify there are no compilation or build regressions:
```bash
./scripts/install-android-prod.sh
./scripts/install-ios-prod.sh --no-launch
```
*Note*: It is acceptable if installation fails due to no connected device/simulator, but any build, compilation, script, or configuration error must be debugged and fixed before considering the task complete.

**Always stop any Firebase emulator instance once you're done with it** — whether
started via `./scripts/run-android-with-emulators.sh` (Ctrl+C tears down
build/install/logcat/emulators together) or started ad hoc (e.g. `firebase
emulators:start --project ...` run directly for a test session): `kill
-SIGINT <pid>` on the `firebase emulators:start` process shuts down its
Firestore/Storage/Functions children cleanly. A leftover instance silently
occupies ports 8080/9099/9199/5001/4400/4500, which then blocks the next
`emulators:start` from binding those ports and has previously caused a
confusing failure that took real debugging effort to trace back to a stray
process from an earlier session.

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
`FirestoreEntryRepository` in `core/src/main/java/com/hejitech/core/`), `wear`
(Wear OS companion — voice capture relayed to the phone for processing, plus
a progress Tile and an hours Complication; see its `capture`/`tile`/
`complication` packages and its own instrumented test suite,
`wear/src/androidTest/`).

- **`android/app/google-services.json`** and **`android/local.properties`** are
  both gitignored (real credentials) — `.example` files document the expected
  shape. Never commit the real ones. Regenerate `google-services.json` via
  `npx -y firebase-tools@latest apps:sdkconfig ANDROID <APP_ID> --project
  contempo-platform` rather than hand-editing it.
- **Two parallel code paths, everywhere, selected by
  `BuildConfig.USE_FIREBASE_EMULATOR`** (true in debug builds): an
  emulator-mode path (fake identities/local Firestore, no real project needed)
  and a real path against `contempo-platform`. See the doc comment on
  `auth/AuthManager.kt` for the canonical example — real Google Sign-In needs
  `BuildConfig.GOOGLE_WEB_CLIENT_ID` (read from `local.properties`, *not* the
  google-services-plugin-generated resource, since that resource only exists
  once an `oauth_client` entry is present) plus Credential Manager + Google
  Identity Services (not the deprecated `GoogleSignInClient` API).
- Firebase Auth, Firestore, Storage, Functions, App Check, Crashlytics,
  Performance Monitoring, and Remote Config are all wired in
  `app/build.gradle.kts` via the Firebase BoM (Crashlytics/Performance also
  need their own Gradle plugins, applied alongside `google-services`);
  Firebase AI Logic (hybrid on-device/cloud inference, see
  `agent/AgentClient.kt`) is pinned directly since it isn't in the BoM yet.
  Crashlytics/Performance collection is toggled off for
  `USE_FIREBASE_EMULATOR` builds (`ContempoApp.onCreate()`) so local dev
  noise never reaches the real console — only a build with that flag false
  (a release-style build) actually reports. Performance custom traces
  (on-device transcription/parsing, the Firestore entry save) go through the
  shared `data/PerformanceTrace.kt` helper; Remote Config's one real flag so
  far, `cloud_ai_enabled`, is a kill switch for cloud AI spend, gated
  centrally in `ServiceLocator`'s `AgentClient.inferencePreference` lambda
  (see `data/RemoteConfigStore.kt`) rather than at each call site.
- **`data/AuthAwareFlow.kt`'s `recoverFromAuthRaceOrSignOut()`** is the
  standard way every eagerly-collected Firestore listener (Capture/Dashboard/
  Confirm ViewModels) handles `PERMISSION_DENIED`/`UNAUTHENTICATED` — retries
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
- `scripts/run-android-with-emulators.sh` is the fastest real-device dev loop —
  starts the Firebase emulator suite, `adb reverse`s the emulator ports to a
  connected physical device, builds/installs/launches the app, streams filtered
  logcat, and tears everything down together on exit.

## `backend/` architecture

The Firebase project root — `firebase` CLI commands (prefixed
`npx -y firebase-tools@latest`) run from here, not the repo root. Project alias
`default` in `.firebaserc` points at the real project, `contempo-platform`.

- **Firestore** (standard edition, `us-central1`): data model is deliberately
  nested under a single owner for MVP (no household/team sharing yet):
  `users/{uid}/properties/{propertyId}`, `users/{uid}/entries/{entryId}`,
  `users/{uid}/corrections/{correctionId}` (the correction-feedback pipeline,
  captured from day one even though unused yet — see MVP scope report Section
  8). `firestore.rules` is ownership-only (`request.auth.uid == uid`, keyed off
  the path segment, not client-supplied data) for read access, **plus
  field-level type/size/range validation on every write** (entry field types
  and enums, string/array/lat-lng bounds, etc. — mirrored by hand from
  `core/model/Entry.kt` and `Property.kt`; a suite in `backend/firestore-tests/`
  (`npm test` there, requires the emulator running — see its README) covers
  the highest-risk boundaries — cross-user isolation, the `roles` collection,
  and `isValidNoteUpdate` — via `@firebase/rules-unit-testing`, though it
  doesn't exhaustively re-test every field constraint on `isValidEntry`; a
  rules change beyond what it covers should still get a manual emulator
  check before deploying). `corrections` is
  additionally append-only at the rules layer (`allow update, delete: if
  false`), not just by client convention. Separately, a top-level (not
  nested under `users/{uid}` — there's no owner) `feedback/{feedbackId}`
  collection backs `feedback/`'s login-free form: public create-only, with
  no read access for anyone including the submitter (review via the
  Firestore console) and a server-pinned `createdAt` (`== request.time`) so
  submissions can't be backdated. Rules deploy automatically from
  `main` via `.github/workflows/firebase-deploy.yml`, authenticating through
  Workload Identity Federation (no service-account key stored anywhere) —
  see that workflow file for the underlying GCP IAM/WIF setup.
- **Auth**: Google Sign-In is enabled via the `auth.providers.googleSignIn`
  block in `firebase.json`, deployed with `firebase deploy --only auth` (this
  is what auto-provisions the web/Android OAuth clients — the Firebase Console
  toggle alone doesn't do this the same way).
- **Functions** (`functions/`, TypeScript, Genkit): `parseEntryFlow` (cloud
  fallback for entry parsing), `flagRisk` (deterministic
  contemporaneity/vagueness heuristics, no LLM call), and `askAgent` (the
  freeform legal-question chat copilot — cloud Gemini Flash, not the curated
  static FAQ the MVP scope doc originally specced). Needs
  `GOOGLE_GENAI_API_KEY` (env var locally, `firebase functions:secrets:set` when
  deployed) only to actually call the cloud model, not to start emulators.
  Separately, `account.ts` has `deleteAccount` (a plain `onCall`, not
  Genkit — recursively wipes a user's Firestore/Storage data via the Admin
  SDK then deletes their Auth account; deliberately `enforceAppCheck: false`
  since it must be callable from web, which has no App Check provider set up
  yet) and `cleanupDeletedUserData` (a v1 Auth `onDelete` trigger, safety-net
  cleanup for accounts removed any other way).
- **Hosting**: two sites, both deployed together via `deploy-hosting` in
  `.github/workflows/firebase-deploy.yml` on every push to `main` (`--only
  hosting`, not scoped to one site — the Firebase CLI runs every hosting
  entry's predeploy hook regardless of which site `--only` narrows to, so
  there's no cost saved by deploying them separately). `contempo` serves
  `web/` (`https://contempo.web.app`); `contempo-feedback` serves
  `feedback/`'s static site (`https://contempo-feedback.web.app`), entirely
  separate registrations/apps despite sharing the `contempo-platform`
  project.
- **Local dev without a real project**: `firebase emulators:start --project
  demo-contempo` runs fully offline against a Firebase "demo project" — no real
  project or billing needed until you're ready to test against the real one.
- See `backend/README.md` for the full layout and first-time setup steps.

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
  is `com.hejitech.contempo`, the Wear OS app is `com.hejitech.wear`. Apply the
  same pattern when iOS (`ios/`) or web (`web/`) code actually starts (iOS bundle
  ID, web package namespace, etc.) — `com.hejitech.<platform-or-app-name>`, not
  `com.contempo.*`.
