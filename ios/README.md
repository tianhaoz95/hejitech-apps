# iOS & watchOS (`ios/`)

The iOS and watchOS companion app implementation for Contempo, feature-matched to `android/` and `android/wear/`.

## Architecture Overview

XcodeGen multi-target project (`ios/project.yml` generates `Contempo.xcodeproj`):

- **`Contempo`**: The main iOS phone app (SwiftUI, iOS 17.0+ target). Features include:
  - Google Sign-In & Firebase Auth (dual-path support: Debug local Firebase emulator vs. production `contempo-str`).
  - Voice, text, and photo work-log capture with on-device Whisper transcription (`SherpaOnnx`) and local LLM parsing (`LiteRtLlm`).
  - Cloud AI fallback via Firebase Genkit Cloud Functions (`parseEntryFlow` and `askAgent` legal copilot).
  - Draft entry review & editing with contemporaneous risk flag heuristics (`ConfirmScreen`).
  - Dashboard with weekly/monthly totals and 100h / 500h / 750h Material Participation test progress tracking (`DashboardScreen`).
  - Entry detail view, editing, photo attachments, and deletion (`EntryDetailScreen`).
  - Timer and Mileage tracking with Live Activity background updates (`TimerLiveActivity`, `TripLiveActivity`).
  - IRS audit defense CSV/PDF/JSON export (`ExportGenerator`).
  - Account deletion via `deleteAccount` Cloud Function.
- **`Contempo Watch App`**: The watchOS companion app (watchOS 10.0+ target).
  - One-tap voice capture, local WAV encoding (`WavAudio`), and durable storage in `PendingCaptureStore`.
  - Automatic background sync to Firebase Storage and `audioCaptures` Firestore queue (`PendingCaptureSyncer` & `WatchAudioCaptureQueueWriter`).
  - Local upload stats tracking (`UploadStatsStore`) and periodic confirmed hours refresh (`WatchEntryStatsReader`).
- **`ContempoWidgets`**: iOS WidgetKit & ActivityKit extension for Live Activities (Timer & Mileage).
- **`Contempo Watch Widgets`**: watchOS Complication extension displaying Material Participation hours progress.
- **`ContempoCore`**: Swift Package (`ios/ContempoCore/`) containing:
  - `ContempoCore`: Platform-agnostic models (`EntryCategory`, `CaptureSource`, `EntryStatus`, `CaptureLanguage`, `RiskFlags`, `MaterialParticipationTest`, `WavAudio`, `HoursProgressStore`, `WatchAudioCaptureQueueWriter`, `WatchEntryStatsReader`).
  - `ContempoFirestore`: Firestore SDK models (`Entry`, `Property`), `FirestoreEntryRepository`, `TimerEntryCoordinator`, and `MileageTripCoordinator`.
  - `ContempoCoreTests`: Unit test suite for models, audio encoding, risk flags, and progress stores.

## Commands

```bash
# Generate Xcode project from project.yml
cd ios && xcodegen generate

# Build the main iOS app scheme for iOS Simulator
xcodebuild -project Contempo.xcodeproj -scheme Contempo -destination 'generic/platform=iOS Simulator' build

# Run ContempoCore Swift Package unit tests
cd ios/ContempoCore && swift test
```
