# app-captures/

Real screenshots of the actual MVP app (`android/`), captured by
`CoreFlowTest` (`android/app/src/androidTest/java/com/hejitech/contempo/CoreFlowTest.kt`)
via Compose's `captureToImage()` — not mockups. Kept separate from
`branding/landing_v0/` on purpose: the landing page doesn't use these yet
(per product-context notes, no real product screenshots were wired in), so
this is just the raw material for whenever that happens.

- `capture.png` — Capture screen, signed in, empty input
- `confirm_filled.png` — Confirm screen with a filled-in manual entry
- `dashboard.png` — Dashboard with one confirmed entry
- `chat.png` — Ask (chat) screen, empty state
- `export.png` — Export screen

## Regenerating

```bash
cd android
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest
adb install -r -t app/build/outputs/apk/debug/app-debug.apk
adb install -r -t app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb reverse tcp:9099 tcp:9099 && adb reverse tcp:8080 tcp:8080 \
  && adb reverse tcp:9199 tcp:9199 && adb reverse tcp:5001 tcp:5001
adb shell am instrument -w -r com.hejitech.contempo.test/androidx.test.runner.AndroidJUnitRunner
adb pull /sdcard/Android/data/com.hejitech.contempo/files/screenshots .
```

Requires the Firebase emulator suite running (`cd ../backend && firebase emulators:start --project contempo-platform`).
Using `am instrument` directly rather than `./gradlew connectedDebugAndroidTest`
is deliberate — the Gradle task uninstalls the app after the run, taking its
external-files screenshots directory with it before you can pull them.
