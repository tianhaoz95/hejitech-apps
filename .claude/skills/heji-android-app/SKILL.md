---
name: heji-android-app
description: Build, run and test a HEJI project's native Android app (Kotlin, Jetpack Compose) on the attached phone, and bring it to parity with its iPhone app -- the Gradle/JDK setup, the local stack over adb reverse, a debug auto sign-in, screenshot and tap-by-text helpers for driving the phone, the house patterns for sign-in (Google through the browser with PKCE, session encrypted in the Keystore), push alerts (FCM delivery only, sent by the project's Worker through the shared Firebase project), What's New and the release check, R8, plus the Compose pitfalls already hit. Use when asked to "work on the Android app", "add X to the Android app", "make Android feature complete / match iOS", "add sign-in on Android", "Android notifications / FCM / push", "test it on my Android phone", "why doesn't the Android build work", or when a project gets its first Android app. Putting it on Google Play is the heji-google-play skill.
---

# Android apps in this repo

Done in full for Headway (2026-11-11: FCM alerts, Google sign-in, parity with the iPhone app); FitLoop
has the same shape. This is that work, generalised. `<name>` is the project (`projects/<name>/`),
`<pkg>` its `applicationId` (`com.hejitech.<name>`). Read the root `CLAUDE.md` and the project's
`CLAUDE.md` first. Shipping to Google Play: skill `heji-google-play`.

## Layout and commands

```
projects/<name>/apps/android/
  core/    Kotlin models (mirrors of the Worker's JSON), the API client, Pacific time helpers; unit tests
  app/     the phone app (Compose Material 3): a ViewModel, ui/screens/*, services
  wear/    Wear OS app, where there is one
  gradle/libs.versions.toml   every dependency version
```

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home   # Gradle 8.11 needs JDK 17; Android Studio's JBR is too new
cd projects/<name>/apps/android
./gradlew :core:test :app:assembleDebug -q            # tests + debug APK (app/build/outputs/apk/debug/app-debug.apk)
./gradlew :app:assembleDebug -PminifyDebug -q         # the same, R8-shrunk like a release: run this before any release
./gradlew :app:lintVitalRelease -q                    # the lint a release build fails on
```

`-q` hides everything but errors; grep the output for `^e: ` (Kotlin) and `FAILED`. The "SDK XML
version" warning is noise.

## Run it on the phone (always the attached phone, not an emulator)

```sh
adb devices                                           # the owner's phone is usually attached
adb reverse tcp:<worker port> tcp:<worker port>       # the phone reaches the Mac's local stack at 127.0.0.1
adb reverse tcp:55421 tcp:55421                       # local Supabase (sign-in)
npm run dev:worker -w @<name>/web                     # the project's Worker (see its CLAUDE.md)
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n <pkg>/.app.MainActivity --ez autoSignIn true    # signs the seed user in on the local stack
adb logcat -d | grep -E "AndroidRuntime|FATAL EXCEPTION"              # crashes
```

- The debug-only **backend switch** (production ⇄ local stack) and the **`autoSignIn` extra** live in
  the app (`AppBackend`, `MainActivity`): a Debug build defaults to production, the local stack is
  `127.0.0.1` on a phone (through `adb reverse`) and `10.0.2.2` on an emulator. Release builds have
  neither. `--es screen <tab>` opens a tab directly.
- **Look at it**: `.claude/skills/heji-android-app/shot.sh <out.png>` (to the scratchpad), then Read
  the PNG. **Drive it**: `.claude/skills/heji-android-app/tap.py "Sign out"` taps by text or content
  description; `--list` prints what is on screen, `--has "Saved"` asserts. Exact text wins over
  "contains" ("Commute" would otherwise hit "Morning commute"). Coordinates from a screenshot need
  scaling by device height ÷ image height. `adb shell input text` types into the focused field,
  `keyevent 61` is Tab, `66` Enter, `KEYCODE_BACK` back.
- **Limits of the owner's phone** (OnePlus/OPPO): `adb shell pm grant` is refused, so the app must ask
  for notification and location permission itself and someone taps Allow; a **locked phone** runs the
  activity but shows nothing and has no UI tree, so say what you could not see rather than guessing.
- Check server effects in the local database, not just on screen:
  `docker exec -i supabase_db_waypack psql -U postgres -Atc "select …"`.
- Use the Worker's demo clock (where the project has one) to test a weekday rush at any hour.

## House patterns (copy from Headway, don't import from another project)

Isolation still applies: a project never references another project's code. Copy the file and rename.

| What | Where in Headway (`projects/headway/apps/android/…`) |
| --- | --- |
| API client without an SDK: Supabase PKCE start/exchange, refresh before every signed-in call, review-account sign-in, typed errors | `core/…/net/HeadwayApiClient.kt` |
| Session encrypted with an Android Keystore AES-GCM key; one signed-in client for services | `app/…/SessionStore.kt` (`SessionStore`, `AppBackend`) |
| App state and routing (`Phase`: launching / signed out / ready; `route()` ends every sign-in path) | `app/…/HeadwayViewModel.kt` |
| Sign-in screen: Google in a Custom Tab, email sheet for issued accounts, debug seed sign-in | `app/…/ui/screens/SignInScreen.kt` |
| Push alerts through FCM | `app/…/PushService.kt`, `res/values/firebase.xml`; Worker `services/web/src/worker/push.ts` |
| What's New, shown once per version | `app/…/ui/screens/WhatsNew.kt` |

**Sign-in.** `Continue with Google` opens `<supabase>/auth/v1/authorize?provider=google&redirect_to=<name>://login-callback&code_challenge=…`
in a Custom Tab (`androidx.browser`); the manifest gives `MainActivity` `launchMode="singleTask"` and an
intent filter for `<name>://login-callback`; `onNewIntent` hands the URI to the ViewModel, which trades
the `code` and the stored verifier for a session. The redirect must be on the shared Supabase
project's allow-list (the iPhone app usually put it there). No Sign in with Apple on Android. The
email entry is for accounts the project hands out (store review): it calls the Worker's
`/api/review-sign-in` (skill `heji-review-account`), never a sign-up. `android:allowBackup="false"`,
so the stored session never leaves the phone.

**Push alerts (FCM for delivery, nothing else of Firebase).**
- One Firebase project for every HEJI app for now: **"HEJI Apps" (`heji-apps`)**, console signed in
  as the owner's dev Google account in Chrome (Claude in Chrome). Register the app there (Project
  settings → Add app → Android → `<pkg>`), download `google-services.json` (ask first: it is a
  download), copy its four values into `res/values/firebase.xml` (`project_id`,
  `gcm_defaultSenderId`, `google_app_id`, `google_api_key`: public identifiers that ship in the APK)
  and delete the JSON. No google-services Gradle plugin, no Analytics; only `firebase-messaging`.
- The Worker sends: a service-account JWT (RS256, WebCrypto) → Google access token (cached) → FCM HTTP
  v1 `messages:send`; `UNREGISTERED`/404 deletes the token. Vars `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`;
  secret `FCM_PRIVATE_KEY` (`~/Credentials/heji-apps-firebase-adminsdk.json`, GitHub secret
  `FIREBASE_SERVICE_ACCOUNT_JSON`). Tokens live in the project's own schema, one row per phone
  (Headway: `push_devices` with `apns_token` or `fcm_token`).
- Send **notification messages** (the system shows them with the app closed) with
  `android.notification.channel_id` and `tag`; the app's `FirebaseMessagingService` shows them while it
  is open and creates the channels at start. Ask for `POST_NOTIFICATIONS` once after sign-in and from
  Settings; register the token after sign-in and in `onNewToken`, remove it at sign-out.
- A phone moves to a new Firebase project only by updating and registering again: see the project's
  `docs/decisions.md` before splitting one out.

**One version, two apps.** `versionName` is read from the iPhone app's `MARKETING_VERSION`
(`apps/ios/project.yml`); the Android What's New has a `CURRENT_VERSION` and the project's
`release.env` `release_check` refuses a release either app's notes don't describe. Write both entries
before `scripts/cut_release.sh`.

## Bringing an Android app to parity with the iPhone app

1. **Audit before building.** Outline both sides and diff them: for each iOS screen
   `grep -n 'struct \|Button("\|Toggle("\|Picker("\|Section("' apps/ios/App/Sources/<View>.swift`, and the
   same for `Text("`/`Button(`/`Switch(` in the Android screens; diff the model fields
   (`HeadwayKit/Models.swift` against `core/…/model/Models.kt`) and the API calls (`Backend.swift`
   against the Kotlin client). Missing model fields hide whole features: the JSON decodes fine without them.
2. **Models and client first**, with a decode test of a real response (`core/src/test`), then the
   ViewModel, then screens.
3. **Mirror the iPhone app's wording and rules** (button labels, footers, defaults, the order of
   cards); adapt only what names the platform ("iPhone alerts" → "Alerts").
4. **Say what has no Android counterpart** instead of faking it: Live Activities / Dynamic Island,
   Sign in with Apple, WidgetKit widgets (a Glance widget is separate work), watch complications.
5. **Test each tab on the phone** against the local stack, and one write per tab against the database.

## Pitfalls already hit

- **Top bar twice as tall**: tabs with their own `Scaffold` inside the activity's `Scaffold` add the
  status bar inset again. Put `.consumeWindowInsets(innerPadding)` after `.padding(innerPadding)` on the
  content.
- **A card added at the top of a `LazyColumn` lands off-screen**: with item keys the list keeps its
  place by the row that was first. Scroll to 0 when such a card appears
  (`LaunchedEffect(key) { listState.animateScrollToItem(0) }`).
- **`remember(key)` and callbacks**: a state created with `remember(settings)` is replaced when
  `settings` changes, so a save callback that sets it writes to the old one ("Saved" never shows).
- **Clipped pills**: `maxLines = 1` alone clips a wrapped second line; add `softWrap = false`.
- **Two composables with one name** in a package (a `private fun Note` in one file, a public `Note`
  in another) is a compile error; keep shared pieces in one place.
- **A row is not its switch**: tapping a label does nothing unless the row is clickable; for tests
  tap the `Switch`.
- **`InvalidFragmentVersionForActivityResult`** fails release lint when Play services drag in an old
  Fragment: depend on `androidx.fragment:fragment` 1.8+.
- **R8** breaks JSON mapping silently if the keep rules miss the `@Serializable` models
  (`app/proguard-rules.pro` keeps `com.hejitech.<name>.core.**`): run the `-PminifyDebug` build through
  sign-in, a board and a settings save before releasing.
- **Sessions in memory** make background services and the watch link useless after the process dies:
  they read the stored session through `AppBackend.client(context)`.
- **`java.util.Base64`** and friends need `minSdk 26` (what these apps use).
- Never print or commit `~/Credentials/…`; new keys go there **and** to GitHub secrets in the same turn.
