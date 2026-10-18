# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Voxbrief is a native Swift/SwiftUI iOS + watchOS app for capturing voice memos on Apple Watch and processing them into cleaned-up Markdown notes on iPhone via an on-device two-stage pipeline (ASR → LLM copywriting). No backend; everything runs on-device.

## In the HEJI monorepo (read first)

Voxbrief lives in `projects/voxbrief` of [`tianhaoz95/hejitech-apps`](https://github.com/tianhaoz95/hejitech-apps)
since 2026-10-16 (imported with its history from `tianhaoz95/voxbrief`, now archived with the
releases up to v1.26.3). The root `CLAUDE.md` has the shared rules; what matters here:

- **Paths:** commands below run from `projects/voxbrief` (the XcodeGen root). Never reference
  another project's files; FeedbackKit is consumed as a Swift package from its archived repo URL,
  never a path into the FeedbackKit project here.
- **No backend:** `backend.env` says `BACKEND=none`. If a feature ever needs one, it joins the
  shared Supabase project in its own `voxbrief` schema (`supabase/README.md`).
- **Releases:** from the repo root, `scripts/cut_release.sh voxbrief --dry-run`, then
  `scripts/cut_release.sh voxbrief` (patch; or `minor`, `major`, `x.y.z`). It refuses unless
  `WhatsNewView.currentVersion` already equals the new version (`release_check` in
  `release.env`), bumps `MARKETING_VERSION` in `project.yml` (every target, including the Mac
  app), and publishes GitHub Release `voxbrief-v<version>` (never "latest": that's Waypack's).
  The release runs `.github/workflows/voxbrief-testflight.yml` (iPhone build with the watch app,
  widgets and keyboard → TestFlight; build number = UTC timestamp) and
  `voxbrief-mac-release.yml` (Developer ID signed, notarized `Voxbrief-<version>-arm64.dmg`
  attached to the release). Don't run `scripts/release_testflight.sh` or `release-mac.sh` by hand
  in place of it, and don't create tags or releases yourself.
- **Mac updates:** `VoxbriefMac/Services/UpdateChecker.swift` lists the monorepo's releases and
  takes the newest published `voxbrief-v` one with a `.dmg` (the repo's `releases/latest` belongs
  to another app). Builds up to 1.26.3 check the archived repo.
- **Signing:** the team-wide HEJI secrets (`SIGNING_P12_*` distribution, `DEV_SIGNING_P12_*`
  development, `MAC_SIGNING_P12_*` Developer ID, `ASC_*`, `APPLE_TEAM_ID`) via
  `.github/actions/apple-signing`. Never let `-allowProvisioningUpdates` mint certificates on an
  empty keychain. Voxbrief-only CI settings would be named `VOXBRIEF_…`.
- **CI:** `.github/workflows/voxbrief-ci.yml` (macOS + iOS unit tests, also every 6 hours).
- **LLM eval:** `.github/workflows/voxbrief-llm-eval.yml` scores the Stage 2 prompts on the bundled
  Lite model (mlx-lm on macOS runners, sharded) only when the prompts or the model in use change, monthly on
  the 15th, or by hand; pass rates land in the run summary next to `evals/llm/baseline.json`. Run
  it after any prompt change, and add a case to `evals/llm/cases.json` for every prompt-quality
  report. See `evals/llm/README.md`.
- **Lite fine-tuning:** `ml/` is the synthetic-data + LoRA pipeline for Lite (teacher on a DGX
  Spark, Kokoro TTS → Whisper base.en for real mishearings, the eval's checks as the data filter,
  MLX 4-bit, published to Hugging Face). Its prompt port must match the app's
  (`python -m voxbrief_ml verify`); keep `ml/voxbrief_ml/app_prompts.py` in step with
  `LLMCopywriterService`. Tests: `voxbrief-ml.yml`. See `ml/README.md`.
- **Site and docs:** the landing page, privacy policy and support page are `site/` (static),
  published at https://tianhaoz95.github.io/hejitech-apps/voxbrief/site/; the developer overview
  is `docs/index.md` (https://tianhaoz95.github.io/hejitech-apps/voxbrief/). Both deploy with the
  repo's `pages.yml`. The old `tianhaoz95.github.io/voxbrief/` URLs redirect there.

## Commands

Regenerate the Xcode project after adding/removing files or changing `project.yml` (this repo uses XcodeGen, not a checked-in-authoritative `.xcodeproj`):
```bash
xcodegen generate
```

The `Voxbrief` target depends on the `WhisperKit` Swift package (see Architecture below). First build after a fresh clone resolves and fetches it from GitHub, which needs network access and takes noticeably longer than subsequent builds:
```bash
xcodebuild -resolvePackageDependencies -project Voxbrief.xcodeproj -scheme Voxbrief
```

Run the full unit test suite (both macOS and iOS):
```bash
./scripts/run_unit_tests.sh        # runs both macOS and iOS unit tests
./scripts/run_unit_tests.sh --mac  # macOS only (VoxbriefMacTests)
./scripts/run_unit_tests.sh --ios  # iOS only (VoxbriefTests)
```

Or run directly via xcodebuild:
```bash
# iOS unit tests
xcodebuild test \
  -project Voxbrief.xcodeproj \
  -scheme Voxbrief \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=NO \
  -only-testing:VoxbriefTests

# macOS unit tests
xcodebuild test \
  -project Voxbrief.xcodeproj \
  -scheme VoxbriefMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO \
  -only-testing:VoxbriefMacTests
```

Run a single test (append the class/method to `-only-testing`):
```bash
xcodebuild test \
  -project Voxbrief.xcodeproj \
  -scheme Voxbrief \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=NO \
  -only-testing:VoxbriefTests/LLMCopywriterServiceTests/testRequirementsExtraction
```

There is no separate lint config; keep to standard Swift API design conventions.

Launch the app on a simulator (builds, installs, and boots automatically — see `scripts/`):
```bash
./scripts/run_ios.sh    # iPhone only
./scripts/run_watch.sh  # Apple Watch only (standalone)
./scripts/run_all.sh    # both, on a paired iPhone + Watch simulator
```
Override the target device with `IPHONE_NAME="..."` / `WATCH_NAME="..."` env vars (see script headers). Simulator-to-simulator WatchConnectivity file transfer is unreliable — use Settings → "Simulate Incoming Watch Audio Sync" in the iOS app to exercise the processing pipeline without depending on it.

Capture screenshots and generate promotional assets for App Store release:
```bash
./scripts/capture_screenshots.sh                  # full pipeline (builds, captures iPhone + Watch, generates promo)
./scripts/capture_screenshots.sh --skip-build     # fast capture using existing DerivedData builds
./scripts/capture_screenshots.sh --iphone-only    # iPhone screenshots only
./scripts/capture_screenshots.sh --watch-only     # Apple Watch screenshots only
./scripts/capture_screenshots.sh --help           # view all options (--device-iphone, --output-dir, etc.)

# Generate or update framed promotional marketing composites independently:
python3 ./scripts/generate_promo_assets.py
```

## Architecture


### Targets (defined in `project.yml`, sources checked out under matching top-level directories)
- `Voxbrief` (iOS 17+) — main app, sources = `Shared/` + `VoxbriefApp/`. Embeds both `VoxbriefWidgets` and `VoxbriefWatch` (see below).
- `VoxbriefWatch` (watchOS 10+) — watch companion, sources = `Shared/` + `VoxbriefWatch/`
- `VoxbriefWidgets` (iOS app extension) — WidgetKit Live Activity, embeds in `Voxbrief`
- `VoxbriefWatchWidgets` (watchOS app extension) — watch face complications, embeds in `VoxbriefWatch`
- `VoxbriefTests` — unit tests in `Tests/UnitTests`, depends on `Voxbrief`

`Voxbrief` embeds `VoxbriefWatch` (`dependencies: - target: VoxbriefWatch, embed: true`) so that archiving just the `Voxbrief` scheme produces one `.ipa` containing the watch app too (nested: `Voxbrief.app/Watch/VoxbriefWatch.app/PlugIns/VoxbriefWatchWidgets.appex`) — required for App Store/TestFlight distribution. This embedding is independent of the simulator dev workflow: `scripts/run_watch.sh` still builds and installs `VoxbriefWatch` standalone onto a watch simulator, unaffected by the embed relationship.

`Shared/` holds code compiled into *both* the iOS and watchOS app targets (models, sync payload contracts, audio constants, formatting extensions). It is not a separate framework target — both apps just include the same source files.

### Watch → iPhone flow
1. **Capture (watch)**: `WatchAudioRecorder` records AAC `.m4a` @ 32kHz mono directly to `Documents/WatchRecordings/<UUID>.m4a`. `WatchStorage` tracks per-recording metadata (`noteId`, `createdAt`, `duration`, `source`, `syncState`). No processing happens on-watch — this is intentional, to keep capture instant and battery-cheap even offline.
2. **Sync**: `VoxbriefWatch/Services/WatchSyncService.swift` (watch side) and `VoxbriefApp/Services/WatchSyncService.swift` (iOS side) are **two independent classes sharing a name**, one per platform — not shared code. They talk to each other only through `WCSession` transfers and the wire format defined in `Shared/Models/SyncPayload.swift` (`WatchSyncPayload`, `SyncConstants` action/key strings). When changing the sync protocol, both files must be updated in lockstep.
3. **Ingest (iOS)**: iOS `WatchSyncService` receives the file via `WCSessionDelegate`, hands it to `AudioFileManager`/`NoteRepository`.
4. **Processing pipeline**: `NoteProcessingPipeline` drives a `VoiceNote` through `NoteProcessingStatus` states (`syncing` → `transcribingASR` → `cleaningLLM` → `ready`/`failed`):
   - Stage 1 — `ASRService` (an actor) runs OpenAI's Whisper (`base.en`) fully on-device via [WhisperKit](https://github.com/argmaxinc/argmax-oss-swift) (SPM package `ArgmaxOSS`, product `WhisperKit`, iOS-only — not linked into `VoxbriefWatch`). No OS speech-recognition permission is needed, only microphone access. The `WhisperKit` pipeline is loaded lazily on first use (model download + CoreML load takes real time) and cached on the actor for reuse; the model itself downloads once from Hugging Face and is cached on-disk thereafter, so only the very first transcription on a fresh install needs network.
   - Stage 2 — `LLMCopywriterService` turns the raw transcript into structured Markdown (bullets for requirements, numbered lists for conditions, checklists for action items, tag extraction, filler-word/grammar cleanup). It also supports an optional local LLM HTTP endpoint (e.g. Ollama) as an alternative to the deterministic built-in transformer — toggled in Settings.
5. **Storage**: `NoteRepository` (`@MainActor`, `ObservableObject`, singleton `.shared`) persists notes as JSON to `Application Support/notes_store.json` — there is no Core Data/SwiftData. All note mutations go through its CRUD methods so the `@Published notes` array and on-disk store stay in sync.

### Complications & Live Activities
- Watch complications (`VoxbriefWatchWidgets`, `WidgetKit`, `.accessoryCircular/.accessoryCorner/.accessoryRectangular/.accessoryInline`) deep-link into the recording flow via `voxbrief://record?source=watch_complication`, handled by `WatchMainRecordView.handleDeepLink`.
- Live Activities (`VoxbriefWidgets`, `ActivityKit`) use `Shared/Models/VoiceNoteActivityAttributes.swift` (hence it lives in `Shared`, not `VoxbriefApp`, since the widget extension target needs it independently of the main app). On iOS, `VoxbriefApp/Services/LiveActivityManager.swift` owns the Activity's start/end lifecycle, and `RecordingCoordinator` (same directory) is the single place that starts/stops an iPhone-direct recording — both the record sheet's UI and the Live Activity's "Stop & Save" link (`voxbrief://record?action=stop`, handled by `RootView.handleDeepLink` in `VoxbriefApp.swift`) go through it, so a recording is only ever finalized one way.
- **Both** `VoxbriefApp/App/Info.plist` and `VoxbriefWatch/App/Info.plist` must declare `CFBundleURLTypes` for the `voxbrief` scheme (set via `project.yml`'s `info.properties`, merged into the checked-in Info.plist by `xcodegen generate`) — without it, none of the above deep links do anything, silently.

### Two Info.plist keys that matter more than they look
- `Voxbrief`'s Info.plist must set `UILaunchScreen: {}` (empty dict is enough). Without it, iOS runs the app in a legacy letterboxed compatibility window instead of edge-to-edge — every screen renders shrunk into a centered box. This is easy to not notice from reading code; it only shows up when you actually run the app.
- `VoxbriefWatch`'s Info.plist sets `WKRunsIndependentlyOfCompanionApp: true` alongside `WKCompanionAppBundleIdentifier`. Without it, `xcrun simctl install` of the watch app alone fails ("Uninstall requested error") because the OS expects the watch app to only ever arrive embedded via the paired iPhone app's install — which this project's target graph doesn't do. It's also the architecturally correct setting anyway, since the whole point of this app is that watch recording works with no iPhone nearby.

### Adding a new `VoiceNote` field or sync field
Changes to `VoiceNote` (`Shared/Models/VoiceNote.swift`) or `WatchSyncPayload`/`SyncConstants` (`Shared/Models/SyncPayload.swift`) affect three consumers that must be kept consistent: the watch-side sync sender, the iOS-side sync receiver, and `NoteRepository`'s JSON persistence (which has no migration layer — it decodes `VoiceNote` directly, so field changes are effectively backward-incompatible with previously persisted JSON).

## Releasing to TestFlight

Releases go through the monorepo's `scripts/cut_release.sh voxbrief` (see above). In CI,
`.github/workflows/voxbrief-testflight.yml` runs `scripts/release_testflight.sh`, which archives
`Voxbrief` (Release config, watch app + both widget extensions embedded) and uploads it to App
Store Connect.

Signing uses an **App Store Connect API key** (`-allowProvisioningUpdates` + `-authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`) for profiles, with the team's pinned identities imported into a throwaway keychain by `.github/actions/apple-signing` (the archive signs with "Apple Development", the export re-signs with the distribution identity). Required credentials (see the script header for the exact env var names and `FA_*` local fallbacks): API Key ID, Issuer ID, the `.p8` key file itself, and `APPLE_TEAM_ID`.

The build number (`CURRENT_PROJECT_VERSION`, wired through `$(CURRENT_PROJECT_VERSION)` in all four Info.plists) is set to a UTC timestamp per run specifically so repeated uploads never collide with App Store Connect's "duplicate build number" rejection — don't reintroduce a hardcoded `CFBundleVersion` literal in any target's Info.plist, or this breaks silently on the second release.

The script fails fast if either `AppIcon.appiconset` (iOS or watch) has no actual image file yet, since a missing 1024×1024 marketing icon otherwise fails App Store validation only *after* a full archive build.

## On-device Stage 2 LLM (MLX Swift + Qwen3) — and why it must never run in the Simulator

`LLMCopywriterService`'s priority order is: **Ollama** (if enabled in Settings) → **Apple Intelligence** (where supported, unless Lite/Flash is picked) → **MLX** (`OnDeviceLLMService`: Flash when in use, else the bundled Lite; also the stand-in wherever Apple Intelligence is unavailable or fails). There is no rule-based fallback (removed in 1.26.6): when no engine runs it throws `LLMCopywriterError.aiEngineUnavailable`, and `NoteProcessingPipeline.process` still saves the transcript, so the note opens on its Transcript tab with a Retry that re-runs only Stage 2. `transformLocally` survives only to structure the legacy Ollama prose rewrite.

**Templates:** first processing auto-detects the template (a classification call, then generation). From a note's template chip the user can regenerate it as another template or auto-detect again (`NoteProcessingPipeline.changeTemplate`): a single template passed to `processTranscript` skips classification. The pick isn't sticky; appending, merging and Re-run detect again. A failed change leaves a ready note untouched and shows an alert.

`OnDeviceLLMService` (`VoxbriefApp/Services/OnDeviceLLMService.swift`) runs Qwen3 via [MLX Swift](https://github.com/ml-explore/mlx-swift-examples) (SPM package `MLXSwiftExamples`, pinned to `exactVersion: 2.29.1`). Pin to a tagged release, not a branch: the `main` branch's model registry is mid-refactor and has, at times, dropped the `MLXLLM`/`MLXLMCommon` products entirely — check that `Libraries/MLXLLM` still exists at whatever ref you consider switching to. Two tiers, both iOS-only (not linked into `VoxbriefWatch`):
- **Bundled**: `Qwen3-0.6B-4bit` ships inside the app as a folder-reference resource (`VoxbriefApp/Resources/Models/Qwen3-0.6B-4bit/`, ~350 MB, loaded via `ModelConfiguration(directory:)`) — always available, zero setup, works offline from first launch.
- **Downloaded**: `Qwen3-4B-4bit` (~2.3 GB from `mlx-community` on Hugging Face) is fetched on demand from Settings → "On-Device Models," and used automatically once present.

**User-facing names:** the UI never names a model. Apple's system model is "Apple Intelligence", the bundled tier is "Lite" and the downloaded tier is "Flash" (`AppleFoundationModelService.modelDisplayName`, `OnDeviceLLMService.smallModelDisplayName`/`largeModelDisplayName`), so swapping the underlying models changes nothing users see. Notes store the engine label; `CleanupEngineLabel.displayName(for:)` maps labels saved by older builds.

Both are prompted for structured JSON (title/summary/requirements/conditions/actionItems/tags), which `LLMCopywriterService` renders through its own `assembleMarkdown` — the model's own prose formatting is never trusted directly, only its structured fields.

**Critical, permanent constraint: MLX does not run in the iOS Simulator.** Its Metal GPU allocator requires a heap storage mode the Simulator's Metal implementation doesn't support, and touching *any* MLX API on Simulator crashes the whole process with an uncatchable C++ `abort()` (`mlx::core::metal::Device::Device()` throwing past Swift's `try/catch` — this cannot be caught, only avoided). This is a known upstream limitation ([ml-explore/mlx#2605](https://github.com/ml-explore/mlx/issues/2605)), not a bug in this integration, and it reproduces identically whether triggered from an XCTest bundle or the real running app. `OnDeviceLLMService.isSupportedOnThisDevice` (`#if targetEnvironment(simulator)`) gates every single entry point — `generate`, `downloadLargeModel`, `refreshLargeModelState` — so none of them ever touch an MLX API on Simulator; they fail with `OnDeviceLLMError.unavailableInSimulator` instead, which `LLMCopywriterService` catches and falls through to the rule-based transformer exactly as if the model had failed for any other reason. **Never remove or bypass this guard** — real device testing is the only way to verify actual on-device generation; Simulator testing can only verify the graceful-failure path.

## Always Populate "What's New" When Making Changes

Whenever **new features**, **bug fixes**, or **improvements** are added to the codebase, they **MUST always be populated in `VoxbriefApp/Views/WhatsNewView.swift`**. Do not ship changes, merge PRs, or cut a release without updating What's New.

### Rules for "What's New" Updates:
1. **New Features (Shown Up Front)**:
   - Add new capabilities and user-facing additions directly to `features: [WhatsNewItem]` in the active `ReleaseHistoryItem`.
   - These are presented prominently on the main screen of `WhatsNewView`.
   - Each item must have an intuitive SF Symbol `icon`, a descriptive `title`, a concise `description`, and a semantic `tint` color.
2. **Bug Fixes & Improvements (Secondary UI)**:
   - Add fixes, performance optimizations, and polish to `improvementsAndFixes: [WhatsNewItem]` in the active `ReleaseHistoryItem`.
   - These are displayed in the secondary UI (`WhatsNewImprovementsView` modal sheet) accessible when users tap the "Bug Fixes & Improvements" card button or navigation bar shortcut.
   - Always tag each item with `kind: .fix` (Bug Fix) or `kind: .improvement` (Improvement).
3. **Version Bumping & Release History**:
   - When preparing a new version release, update `WhatsNewView.currentVersion` (e.g. `"1.22.0"`). This triggers the automated presentation prompt for users upon updating (`WhatsNewView.shouldShowAutomatically`).
   - Prepend a new `ReleaseHistoryItem` at index 0 of `WhatsNewView.releases`.
   - **Never overwrite or delete previous release notes**; retain existing versions in the array so users can browse historical version notes in the app's version browser.
   - Update `Tests/UnitTests/WhatsNewViewTests.swift` (`testCurrentVersionMatchesReleases` and `expectedVersions`) to verify the new version numbers and content counts.
4. **Rich Detail Pages & Interactive Visualizations (Optional)**:
   - Tapping any feature or improvement/fix row in `WhatsNewView` or `WhatsNewImprovementsView` opens a dedicated interactive detail sheet (`WhatsNewFeatureDetailView`).
   - Major items can be populated with optional rich content fields:
     - `detailedDescription: String?`: In-depth narrative or technical deep dive explaining architectural, privacy, or UX enhancements.
     - `highlights: [String]?`: Structured array of bulleted key points and capabilities rendered with semantic checkmarks.
     - `screenshotName: String?`: Asset catalog image name for visual preview screenshots (with graceful styled fallback if not present).
     - `visualization: WhatsNewVisualization?`: Interactive SwiftUI preview widget embedded directly in the detail card:
       - `.waveform`: Animated real-time audio waveform equalizer with live input pause/resume simulation.
       - `.swipeGesture`: Apple Watch frame mockup showing paged swipe navigation between Capture hero and Memo Vault with native pagination dots.
       - `.pipeline`: Step-by-step interactive 4-stage on-device pipeline diagram (Audio ➔ WhisperKit ASR ➔ Qwen3 LLM ➔ Markdown Note).
       - `.vwaveMark`: Interactive bespoke flat V-Wave monogram inspector with color theme switching and geometry breakdown.
       - `.complications`: Apple Watch face complications showcase (Circular, Corner, Rectangular).
   - All rich detail fields are strictly optional (`nil` by default) so minimal or historical release entries continue to function seamlessly without breaking changes.

