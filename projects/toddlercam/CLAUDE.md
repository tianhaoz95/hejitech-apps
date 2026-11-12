# CLAUDE.md

ToddlerCam (`com.hejitech.kidscam`, App Store id6810526172) is a native Swift/SwiftUI iPhone/iPad
dual-camera app for toddlers with an Apple Watch remote for the parent. Kids Category: no backend,
no accounts, no third-party SDKs, no analytics. Everything runs on the devices (TestFlight builds
add opt-in feedback, below).

## In the HEJI monorepo (read first)

ToddlerCam lives in `projects/toddlercam` of [`tianhaoz95/hejitech-apps`](https://github.com/tianhaoz95/hejitech-apps)
since 2026-10-19 (imported with its history from `tianhaoz95/toddler-cam`, archived with its
v1.2.1 … v1.2.3 tags). The root `CLAUDE.md` has the shared rules; what matters here:

- **Paths:** commands below run from `projects/toddlercam` (the XcodeGen root). Never reference
  another project's files.
- **No backend:** `backend.env` says `BACKEND=none`. If a feature ever needs one, it joins the
  shared Supabase project in its own `toddlercam` schema (`supabase/README.md`), and the Kids
  Category privacy promises in `site/privacy.html` and `AppStore/PRIVACY_POLICY.md` change with it.
- **project.yml is the source of truth.** `KidsCam.xcodeproj` and the three Info.plists are
  generated (`xcodegen generate`); CI and releases regenerate them, so hand edits there are lost.
  Info.plist keys go in each target's `info.properties`. Versions come from `MARKETING_VERSION`
  (all targets) and `CURRENT_PROJECT_VERSION` (CI sets a UTC timestamp).
- **Releases:** from the repo root, `scripts/cut_release.sh toddlercam --dry-run`, then
  `scripts/cut_release.sh toddlercam` (patch; or `minor`, `major`, `x.y.z`). It bumps
  `MARKETING_VERSION` and publishes GitHub Release `toddlercam-v<version>` (never "latest": that's
  Waypack's), which runs `.github/workflows/toddlercam-testflight.yml` → `Scripts/release_testflight.sh`
  (archive with the watch app and complications embedded, upload to TestFlight). The same workflow
  runs weekly on Wednesdays (18:30 UTC) from `main`. Don't run the script by hand in place of a
  release, and don't create tags or releases yourself. App Store submission is by hand in App Store
  Connect (`AppStore/APP_STORE_METADATA.md`).
- **Google Play:** app "ToddlerCam: Toddler Camera" (no "Dual": the Android app takes single-camera photos) (`com.hejitech.toddlercam`, Play app ID `4975262664896253012`) in the
  HEJI TECH LLC console, Wear OS form factor added. Phone and watch apps share the package (one
  listing; the Wear Data Layer also needs it) and differ in version code (watch = phone + 1).
  `toddlercam-play-internal.yml` builds both on every `toddlercam-v*` release, signs them with the upload key
  (`~/Credentials/toddlercam/android-upload.env`, GitHub secrets `TODDLERCAM_ANDROID_*`) and rolls them out to
  `internal` and `wear:internal` (testers: "HEJI owner"). Version name = `MARKETING_VERSION`.
  Steps and checks: the `heji-google-play` skill (`play.mjs check com.hejitech.toddlercam`). Store
  listing text and assets (phone, 7"/10" tablet and Wear OS screenshots from the emulators): `GooglePlay/`.
- **Signing:** team `68CTFST8W2`, automatic. CI uses the team-wide HEJI secrets (`SIGNING_P12_*`
  distribution, `DEV_SIGNING_P12_*` development, `ASC_*`, `APPLE_TEAM_ID`) via
  `.github/actions/apple-signing`. ToddlerCam-only CI settings would be named `TODDLERCAM_…`.
- **Feedback:** FeedbackKit project "ToddlerCam" (`d124f9ed-81eb-4d43-b02f-64c971bdb518`, key `pk_6619b4d70c72fd8f73413dc1d070e6ab0206`, package from
  `github.com/tianhaoz95/feedback-kit`). TestFlight (and Debug) builds only: `AppTransaction` decides at launch,
  and App Store installs never configure FeedbackKit or show the setting, which is why the privacy
  policies still say "no data collection". There it is shake to report only, behind a parent
  setting that defaults to **off** (`ParentFeedback.swift`, toggle in Parent Settings behind `ParentGateView`); off means FeedbackKit
  is fully disabled. Never add a floating button, turn it on by default, or enable it on the App
  Store without updating the privacy policies and App Privacy labels first (Kids Category). Releases announce each build to FeedbackKit with
  `TODDLERCAM_FEEDBACKKIT_RELEASE_TOKEN`; fix commits get a `FeedbackKit: <id>` trailer.
- **CI:** `.github/workflows/toddlercam-ci.yml` builds the watch targets and runs the iOS unit tests.
- **Site and docs:** the landing page, privacy policy, terms and support page are `site/` (static),
  published at https://tianhaoz95.github.io/hejitech-apps/toddlercam/site/; the developer overview
  is `docs/index.md` (https://tianhaoz95.github.io/hejitech-apps/toddlercam/). Both deploy with the
  repo's `pages.yml`. The old `tianhaoz95.github.io/toddler-cam/` URLs redirect there.

## Commands

```sh
# iOS & watchOS
xcodegen generate          # after changing project.yml or adding/removing files
./Scripts/build.sh         # regenerates sounds + project, builds all three targets for the simulator
./Scripts/run_tests.sh     # iOS unit tests (simulator)

# Android & Wear OS
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
cd apps/android
./gradlew :core:test :app:assembleDebug :wear:assembleDebug -q
```

Test on the attached iPhone (and paired watch) whenever the change touches the cameras,
WatchConnectivity or haptics: the simulator falls back to `SimulatorCameraStreamer` and demo media.
For Android, test on the attached phone (`adb -s <device> install -r app/build/outputs/apk/debug/app-debug.apk`).

The screenshot tests in `KidsCamTests` write the App Store screenshots into `AppStore/Screenshots/`
of the checkout they run from. Every test run rewrites them; commit them only when you mean to
update the store listing.

## Architecture

- `KidsCam/Camera`: `DualCameraManager` (AVCaptureMultiCamSession, photo + `DualVideoRecorder`),
  `DualPhotoRenderer` (composite keepsake), simulator/demo fallbacks.
- `KidsCam/UI`: toddler camera screen, parent hub behind `ParentGateView`, toddler lock overlay.
- `KidsCam/Vision`: face tracking emoji masks (`FaceEmojiType` is shared with the watch target).
- `KidsCam/Connectivity` ↔ `KidsCamWatch/Remote`: the WCSession bridge (shutter, camera swap,
  masks, lock, soundboard, last-photo thumbnail).
- `KidsCamWatch/Intents`: App Intents & `AppShortcutsProvider` for Siri, Shortcuts app, Action Button, and URL launcher schemes (`toddlercam://`, `kidscam://`).
- `KidsCamWatchWidgets`: WidgetKit complications.
- `KidsCam/GuidedAccess`, `KidsCam/WatchFace`, `KidsCam/Audio` (synthesized by `Scripts/generate_sounds.py`).

### Android & Wear OS (`apps/android`)

- `core/`: shared Kotlin models (`FaceEmojiType`, `SoundType`, `CameraCaptureMode`, `ToddlerState`), `WatchConstants`, `WatchActionMessage`, and unit tests.
- `app/`: phone app (`com.hejitech.toddlercam`) built with Jetpack Compose & CameraX:
  - `camera/DualCameraManager`: CameraX multi-camera preview, PIP swap, 1200x1600 keepsake composite renderer, and MediaStore saving.
  - `audio/SoundManager`: low-latency `SoundPool` engine loading raw WAV soundboard effects.
  - `ui/`: `ToddlerCameraScreen`, chunky 86dp bouncy shutter button, `ToddlerLockOverlay` bubble popping canvas, `ParentGateDialog` math challenge, and `ParentHubDialog`.
  - `wear/`: `PhoneWearableManager` and `PhoneWearableService` syncing state and sending photo thumbnails to connected Wear OS watches over Google Play services Wearable Data Layer API.
- `wear/`: Wear OS parent remote app (package `com.hejitech.toddlercam`, code namespace `…toddlercam.wear`) with Wear Compose:
  - `WearApp`: giant wrist shutter button with haptic feedback, attention grabber buttons (🐶 Puppy, 🦆 Duck, 🐱 Kitty, 👶 Baby), camera flip, screen lock toggle, face mask selector, and last photo preview.
  - `ToddlerCamTileService`: Wear OS carousel tile for quick wrist shutter and remote launch.
  - `ToddlerCamComplicationService`: watch face complication.
