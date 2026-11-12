# Headway

Caltrain status on Apple Watch, Even G2 glasses + R1 ring, with iPhone alerts. A Worker merges Caltrain's
timetable (compiled in) with 511.org's live feed into boards for the glasses, the iPhone app, the
web page and an MCP server, and its every-minute cron pushes alerts through APNs (iPhone) and FCM (Android). Layout:
`README.md`. Why things are the way they are: `docs/decisions.md` (read it before changing
behaviour). Going live: `docs/DEPLOY.md`. Read the root `CLAUDE.md` too.

## Commands (from the repo root)

```sh
npm run test:headway && npm run typecheck:headway      # core (timetable, live merge, alerts, glasses, GTFS-RT) + plugin
npm run build:headway                                  # web (WEB_ALLOW_LOCAL=1 without production env) + glasses
node projects/headway/scripts/build-timetable.mjs      # new Caltrain timetable → packages/core/src/timetable.gen.json

# local stack: `supabase start` from the repo root (seed: rider@example.com / headway-dev)
echo "SUPABASE_SERVICE_ROLE_KEY=<local service key>" > projects/headway/services/web/.dev.vars
npm run dev:worker -w @headway/web                     # 127.0.0.1:8792 (+ TRANSIT_511_API_KEY in .dev.vars for live data)
curl "http://127.0.0.1:8792/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"   # run the cron once
curl -X PUT 127.0.0.1:8792/api/dev/clock -d '{"at":"2026-11-09T07:40:00-08:00"}'   # local only: pretend it's then ({"at":null} resets)
node projects/headway/scripts/test-api.mjs             # integration (25 checks: boards, on-train, commute done, pairing, push, family, MCP/OAuth, RLS)
projects/headway/scripts/glasses-sim.sh [--e2e]        # the plugin in the Even Hub simulator, paired to the seed rider
npm run package -w @headway/glasses                    # apps/glasses/build/headway.ehpk (version = MARKETING_VERSION)

cd projects/headway/apps/ios/HeadwayKit && swift test  # models, API client, sign-in helpers
cd projects/headway/apps/ios && xcodegen generate      # Headway.xcodeproj is generated and git-ignored
xcodebuild -project Headway.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' -derivedDataPath .derived CODE_SIGN_IDENTITY=- build

# Android & Wear OS apps
./projects/headway/apps/android/gradlew -p projects/headway/apps/android :core:test          # shared Kotlin models, clock & sync
./projects/headway/apps/android/gradlew -p projects/headway/apps/android :app:assembleDebug   # Android mobile app (Compose Material 3)
./projects/headway/apps/android/gradlew -p projects/headway/apps/android :wear:assembleDebug  # Wear OS watch app (Wear Compose + Tile + Complication)
```

Local tokens from the seed: glasses `hwd_dev_local_device`, assistant `hwa_dev_local_token` (MCP at
`http://127.0.0.1:8792/mcp`). App Review demo account: locally `review@example.com` /
`headway-review-dev` (wrangler.jsonc vars); production via `scripts/review_account.sh headway`
(`review.env`, skill heji-review-account). iPhone launch arguments (Debug): `-autoSignIn` (seed rider on the local
stack), `-reviewSignIn` (the App Review sign-in path), `-screen trains|commute|family|settings`, `-production` (Debug build against production).

## Architecture

- **`@headway/core` is the one engine** (`packages/core/src`): `schedule.ts` (timetable → departures,
  live predictions, boards, the commute leg for now, a train's progress), `alerts.ts` (which
  notifications are due and which are priority, pure), `ontrain.ts` (which train a phone's fixes are riding,
  the in-train card), `family.ts` (family groups: who sees what, follows, which family notifications are due), `glasses.ts` (screens laid out in pixels by `font.ts`'s measured
  glyph widths, 9 lines in a bordered frame, and the R1 `Navigator`), `gtfsrt.ts` (protobuf
  reader), `settings.ts` (defaults + `checkSettings`). Change behaviour there, with a test; never
  format glasses text elsewhere.
- **Worker** (`services/web/src/worker`): `api.ts` (public boards, session / glasses token, pairing,
  push registration), `review.ts` (App Review's demo account: `/api/review-sign-in` checks the
  Worker's REVIEW_* secrets, resets the account to a demo commute and mints a Supabase session; no
  email sign-in for people), `cron.ts` + `realtime.ts` (511 → `headway.realtime` snapshot, alert engine →
  `push.ts`: APNs for iPhones, FCM's HTTP v1 API for Android phones; a `push_devices` row has one token or the other), `family.ts` (`/api/family/*` and the cron's family pass: notifications and
  followed-train Live Activities, update tokens `follow:<sharer>:<trip>`), `mcp.ts` (seven tools), `store.ts`. Service key only here; clients read their own
  rows through RLS and every write goes through the Worker.
- **Plugin** (`apps/glasses/src`): `app.ts` (HeadwayApp: board sources, offline timetable, tracking,
  pairing; tested with fakes) and `main.ts` (bridge, one full-screen text container, R1 events, the
  phone page). Production API only (`https://headway.hejitech.workers.dev`, its one whitelist entry).
- **iPhone app** (`apps/ios`): `HeadwayKit` (Codable mirrors of core's JSON, the Worker client,
  Supabase sign-in without an SDK) and `App/Sources` (`AppModel` drives `phase`; `route()` ends every
  sign-in path). Release builds use production, Debug the local stack. Tabs: Trains (board, flip,
  pick, swipe to track), Commute (legs, alerts), Family (group, shares, follows, status, invites), Settings (alerts, on-train mode, location estimate, Even G2 glasses pairing, account, What's New, delete data). Keeps the Watch in step via `WatchLink`.
  `Widgets/`: the Home/Lock Screen "Next trains" widget (stations picked in its App Intent, public board, no
  App Group), the tracked-train Live Activity and the "next trains" board Live Activity (pinned from the Trains
  tab; the cron pushes it via update tokens whose `trip_id` is `board:<from>><to>`).
- **Apple Watch app** (`apps/ios/Watch`): Companion watchOS app with glanceable departure board, live delays, countdowns, direction flip, express filtering, and train progress tracking synced with the iPhone app via WatchConnectivity and able to refresh directly.
- **Android app** (`apps/android/app`): Native Jetpack Compose Material 3 phone app, kept at parity with the iPhone app (what has no counterpart: Live Activities and pinning to the Lock Screen, the Home Screen widget, Sign in with Apple). `HeadwayViewModel` mirrors `AppModel` (`Phase`; `route()` ends every sign-in path); `SessionStore` keeps the session encrypted (Keystore) and `AppBackend.client()` gives services a signed-in client. Sign-in: Google in a browser tab with PKCE back to `headway://login-callback`, or email for issued accounts (`/api/review-sign-in`). Tabs: Trains (leave-by card, tip, badges, sort, flip, pick stations, track, share live ETA, on-train and commute-done cards), Commute (both legs in full, alert days, every alert), Family (group, shares, follows, status, invites), Settings (alerts, on-train mode, location estimate, Even G2 glasses pairing, account, What's New, delete data). Skill: `heji-android-app`. Keeps paired Wear OS watches in step via Google Play Services Wearable Data Layer (`/headway/sync_state`). Alerts arrive through FCM (`PushService`; token registered at sign-in with `POST /api/push {platform: "android"}`; Firebase is configured by `res/values/firebase.xml`, no google-services plugin). Debug builds default to production and can switch to the local stack (Settings › Developer, or the sign-in screen); `adb shell am start -n com.hejitech.headway/.app.MainActivity --ez autoSignIn true` switches and signs the seed rider in, `--es screen commute` opens a tab (a phone on USB needs `adb reverse tcp:8792 tcp:8792; adb reverse tcp:55421 tcp:55421`). On the local stack the app follows the Worker's demo clock (`Clock.offsetMs`).
- **Wear OS app** (`apps/android/wear`): Companion smartwatch app built with Wear Compose. Features live wrist departure board, one-tap trip tracking, a glanceable Wear OS Tile (`HeadwayBoardTileService`) on the watch carousel, and a watch face complication (`NextTrainComplicationService`) for departure countdowns.
- **Android Core library** (`apps/android/core`): Shared Kotlin data models, Caltrain station index, Pacific time conversions (`Clock`), coroutine HTTP API client (`HeadwayApiClient`), and Wearable Data Layer message serialization (`WatchSyncState`).

## Pitfalls

- `test-api.mjs`'s "Not on it" uses its second user: on the seed rider it hides the card for 20 minutes.
  To simulate a ride on the simulator, `xcrun simctl location booted start --speed=22 --interval=3 lat,lon lat,lon …`
  along the stations of a train running now.
- Locally, "now" is the Worker's demo clock (`worker/clock.ts`, `/api/dev/clock`): use it to test a weekday rush,
  a late night or a delay at any time. The Debug app and the plugin read it at launch (relaunch after moving it);
  restarting the Worker resets it. Server code takes `now(env)`, never `Date.now()`, for anything a rider sees.
- Times are Pacific everywhere (`core/src/time.ts`); GTFS service days start at noon minus 12 h, and
  trains after midnight belong to the day before.
- 511's trip updates don't always carry a `start_date`: `liveTrip` then gives the update to the run
  nearest the snapshot, never yesterday's run of the same train (it showed "+1,440 min" and won on-train
  detection). Keep that when touching the live merge (`test/servicedate.test.ts`).
- The timetable runs out (`feed_end`; a core test fails 21 days before): rebuild it with
  `build-timetable.mjs` when Caltrain publishes a new one, and check new stations get a short name.
- PostgREST only sees `headway` after `supabase start` with it in `config.toml` (restart the stack
  after adding a schema). Worker isolates cache the snapshot for 20 s.
- Locally `wrangler dev` runs cron at `/cdn-cgi/handler/scheduled`, not `/__scheduled`.
- An unsigned simulator build can't use the Keychain (the session doesn't survive a relaunch): build
  with `CODE_SIGN_IDENTITY=-`.
- The family cron pass only runs with APNs or FCM configured, so locally it's skipped: to exercise it, put a throwaway
  P-256 key in `.dev.vars` (APNS_TEAM_ID/KEY_ID/PRIVATE_KEY); pushes then fail at Apple but keys are recorded.
  `FCM_PRIVATE_KEY` in `.dev.vars` (the service account's key, `\n` for newlines) sends real alerts to Android phones,
  and then `test-api.mjs`'s push steps fail (they expect an unconfigured server).
- Gradle needs JDK 17 (`JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`); Android Studio's JBR is too new.
- The Even SDK returns a bridge object in any browser: `main.ts` checks `flutter_inappwebview` first.
  Simulator screenshots are RGBA with the text in alpha: composite on black to look at them.
- No "Apple" in any App Intent strings if intents are added (root CLAUDE.md pitfall).
- Even Hub review rules the plugin keeps (`heji-even-hub-submit` skill, `docs/decisions.md`): double
  tap on the board (the root page) sends `exit` → `shutDownPageContainer(1)`; menus live on a hold;
  unpaired it opens on a live default board; every gesture answers. Listing kit: `docs/even-hub/`.

## Releasing

**What's New** (`apps/ios/App/Sources/WhatsNewView.swift` and Android's `ui/screens/WhatsNew.kt`): every
release prepends its notes to both and sets `currentVersion` / `CURRENT_VERSION`; `release.env`'s
`release_check` refuses a version either doesn't describe.
`scripts/cut_release.sh headway --dry-run`, then for real: it bumps `MARKETING_VERSION`, pushes
(Cloudflare deploys the Worker) and publishes `headway-v<version>` → `headway-testflight.yml`
(iPhone), `headway-glasses-release.yml` (the `.ehpk`, attached to the release, uploaded to Even Hub and promoted to Beta)
and `headway-play-internal.yml` (the Android app, same version, to Google Play's internal testing track).

**Google Play**: app "Headway: Caltrain Alerts" (`com.hejitech.headway`, Play app ID 4975322077562037950), internal
testing (phone `internal`, watch `wear:internal`: the Wear OS app shares the package and its version code is the
phone's + 1), tester list "HEJI owner". Store listing, screenshots, declaration answers and the background-location
demo video: `GooglePlay/` (`LISTING.md` says which Play forms are still the owner's). Background location ("On a
train → Also with the app closed") is behind an in-app disclosure (`SettingsScreen.kt` `LocationDisclosure`) that
Play's policy requires before Android's prompt; keep it if that flow changes. Upload key in `~/Credentials/headway/` and the
`HEADWAY_ANDROID_*` GitHub secrets. `versionName` is read from `apps/ios/project.yml`'s MARKETING_VERSION; release
builds are R8-shrunk (`app/proguard-rules.pro`) and target API 36. The Android app signs in with Google (browser
PKCE to `headway://login-callback`, session kept encrypted by `SessionStore`) or the review email account; its What's New
(`ui/screens/WhatsNew.kt`) is checked by `release_check` alongside the iPhone one. Steps: skill `heji-google-play`.
