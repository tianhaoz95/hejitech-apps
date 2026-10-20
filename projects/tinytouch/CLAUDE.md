# CLAUDE.md — Developer & Agent Guide for TinyTouch

Welcome to **TinyTouch** (formerly ToddlerPlay). This document is the source of truth for AI agents and human contributors working on this project (`AGENTS.md` links here).

## In the HEJI monorepo (read first)

TinyTouch lives in `projects/tinytouch` of [`tianhaoz95/hejitech-apps`](https://github.com/tianhaoz95/hejitech-apps)
since 2026-10-19 (imported with its history from `tianhaoz95/TinyTouch`, now archived). The root
`CLAUDE.md` has the shared rules; what matters here:

- **Paths:** commands below run from `projects/tinytouch`. Never reference another project's files.
- **No backend:** `backend.env` says `BACKEND=none`. If a feature ever needs one, it joins the
  shared Supabase project in its own `tinytouch` schema (`supabase/README.md`), and the Kids
  Category privacy promises (`site/privacy.html`, `metadata/privacy_policy.md`) change with it.
- **Xcode project:** `tools/generate_project.py` writes `ToddlerPlay.xcodeproj` (no XcodeGen). It
  keeps the `DEVELOPMENT_TEAM` and `MARKETING_VERSION` it finds in `project.pbxproj`; every target
  shares that version, and Info.plist versions come from `$(MARKETING_VERSION)` /
  `$(CURRENT_PROJECT_VERSION)`. CI fails if the committed project differs from the generator's
  output, so change build settings in the generator, run it, and commit both.
- **Releases:** from the repo root, `scripts/cut_release.sh tinytouch --dry-run`, then
  `scripts/cut_release.sh tinytouch` (patch; or `minor`, `major`, `x.y.z`). It bumps
  `MARKETING_VERSION` in `project.pbxproj` and publishes GitHub Release `tinytouch-v<version>`
  (never "latest": that's Waypack's), which runs `.github/workflows/tinytouch-testflight.yml` →
  `tools/release_testflight.sh` (archive with the watch app and widget embedded, upload to
  TestFlight, build number = UTC timestamp). The same workflow runs weekly on Wednesdays (18:45 UTC)
  from `main`. Pushes no longer upload builds. Don't run the script by hand in place of a release,
  and don't create tags or releases yourself. App Store submission is by hand (`metadata/`).
- **Signing:** team `68CTFST8W2`, automatic. CI uses the team-wide HEJI secrets (`SIGNING_P12_*`
  distribution, `DEV_SIGNING_P12_*` development, `ASC_*`, `APPLE_TEAM_ID`) via
  `.github/actions/apple-signing`; the old repo's own secrets and `upload_ci_secrets.py` are gone.
  TinyTouch-only CI settings would be named `TINYTOUCH_…`.
- **Feedback:** FeedbackKit project "TinyTouch" (`4b41d9bb-dbe4-4c88-b3d9-90a3ee08426f`, key `pk_66d3a549ae0915c22927f9c7b417ce337c85`, package from
  `github.com/tianhaoz95/feedback-kit`). TestFlight (and Debug) builds only: `AppTransaction` decides at launch,
  and App Store installs never configure FeedbackKit or show the setting, which is why the privacy
  policies still say "no data collection". There it is shake to report only, behind a parent
  setting that defaults to **off** (iPhone app only, `TinyTouchiOS/Sources/Services/ParentFeedback.swift`, toggle under Beta Feedback on the parent dashboard; the package reference is written by `tools/generate_project.py`); off means FeedbackKit
  is fully disabled. Never add a floating button, turn it on by default, or enable it on the App
  Store without updating the privacy policies and App Privacy labels first (Kids Category). Releases announce each build to FeedbackKit with
  `TINYTOUCH_FEEDBACKKIT_RELEASE_TOKEN`; fix commits get a `FeedbackKit: <id>` trailer.
- **CI:** `.github/workflows/tinytouch-ci.yml` (`swift tools/run_tests.swift`, generator drift
  check, iPhone build with the watch app embedded).
- **Site and docs:** the landing page, privacy policy and support page are `site/` (static, was
  `docs/`), published at https://tianhaoz95.github.io/hejitech-apps/tinytouch/site/; the developer
  overview is `docs/index.md` (https://tianhaoz95.github.io/hejitech-apps/tinytouch/). Both deploy
  with the repo's `pages.yml`. The old `tianhaoz95.github.io/TinyTouch/` URLs redirect there.

---

## 1. Project Overview & Mission

**TinyTouch** is a dual-purpose child-development play experience and accidental-touch shield designed for parents holding toddlers (18 months to 3 years old) while wearing an Apple Watch, paired with an iPhone companion app.

### Core Problems Solved:
1. **Accidental-Touch Lockdown**: Normal watchOS apps allow toddlers to swipe open Notification Center, Control Center, or tap watch complications that trigger emergency phone calls (911/SOS). TinyTouch captures 100% of edge-to-edge screen touches, tames the Digital Crown into a musical toy, and protects all exits behind a **3-second continuous hold Parent Shield**.
2. **Pediatric Low-Stimulation Play**: Designed according to American Academy of Pediatrics (AAP) recommendations. Zero rapid flashing, zero predatory reward mechanics, zero losing states. Built around harmonic pentatonic chimes (impossible to play discordant notes), gentle animal sounds, and a soothing bedtime lullaby auto-transition.
3. **iPhone Remote Control & Telemetry**: Parents can switch game modes, trigger lullabies, set session timers, and view real-time touch counts on their iPhone without prying the Apple Watch off their wrist or out of their child's hands.

### Identifiers & Settings:
- **iOS Companion App Bundle ID**: `com.tianhaoz.tinytouch`
- **watchOS App Bundle ID**: `com.tianhaoz.tinytouch.watchkitapp`
- **Complication Widget Bundle ID**: `com.tianhaoz.tinytouch.watchkitapp.widget`
- **Development Team ID**: `68CTFST8W2` (HEJI TECHNOLOGY LLC)
- **Marketing Version**: `MARKETING_VERSION` in `ToddlerPlay.xcodeproj/project.pbxproj` (1.5.0 at the move; App Store Connect had 1.5)
- **Build Number**: set by CI (UTC timestamp)
- **Minimum Deployments**: iOS 17.0+ / watchOS 10.0+
- **Category**: Games > Kids (Ages 5 and Under), Family

---

## 2. System Architecture

```
                    ┌─────────────────────────────────────────┐
                    │            iPhone Companion             │
                    │        (com.tianhaoz.tinytouch)         │
                    └────────────────────┬────────────────────┘
                                         │
                         WatchConnectivity (WCSession)
                    (Bi-directional: Remote Switch & Telemetry)
                                         │
                    ┌────────────────────▼────────────────────┐
                    │               watchOS App               │
                    │   (com.tianhaoz.tinytouch.watchkitapp)  │
                    └─────────┬──────────────────────┬────────┘
                              │                      │
                   Embedded / Co-located        Complication
                              │                      │
                    ┌─────────▼────────┐   ┌─────────▼────────┐
                    │ 5 Sensory Games  │   │ TinyTouchWidget  │
                    │ Parent Shield 3s │   │ (WidgetKit appex)│
                    └──────────────────┘   └──────────────────┘
```

### Targets & Schemes:
- **`TinyTouch` Scheme**: Builds the primary iOS companion app target (`TinyTouch.app`) and embeds the watchOS app (`ToddlerPlay.app`) inside `TinyTouch.app/Watch/`, which in turn embeds `TinyTouchWidget.appex` inside its `PlugIns/`.
- **`ToddlerPlay` Scheme**: Builds the standalone watchOS app for direct debugging on the watchOS Simulator or Apple Watch hardware.

### Subsystems:
1. **WatchConnectivity Communication Layer (`WCSession`)**:
   - iOS: `TinyTouchiOS/Sources/Services/IOSSettingsSyncManager.swift`
   - watchOS: `ToddlerPlay/Sources/Services/WatchConnectivityManager.swift`
   - **Tiered Dispatch**: Sends via `sendMessage` if watch is reachable, falling back to `updateApplicationContext` and `transferUserInfo` for guaranteed background receipt.
   - **Enum Normalization**: Raw values are case-insensitive and whitespace-tolerant (`"bubbles"`, `"animals"`, `"soundGarden"`, `"sparkles"`, `"lullaby"`, legacy `"Xylophone"`).
   - **Telemetry**: Watch streams live `touchCount`, `timeRemaining`, and `activeMode` back to the iPhone dashboard.
   - **UX Auto-Dismissal**: Remotely switching game mode auto-dismisses any open watch parent dashboard so the child immediately sees the new activity.

2. **Screen Persistence (`WKExtendedRuntimeSession`)**:
   - `ToddlerPlay/Sources/Services/SessionKeeper.swift` initiates a `.selfCare` session to prevent screen sleep while the child touches the watch.

3. **Audio Synthesis & Low-Latency Playback**:
   - 16 custom synthesized 16-bit 44.1kHz PCM WAV files in `Resources/Sounds/`.
   - Pre-warmed `AVAudioPlayer` pools in `SoundManager.swift` (watchOS) and `IOSSoundManager.swift` (iOS).
   - Speech pronunciation using `AVSpeechSynthesizer` with child-friendly pitch multiplier (`1.25`).

4. **Tactile Haptics**:
   - watchOS: `ToddlerPlay/Sources/Services/HapticsManager.swift` using `WKInterfaceDevice.current().play()`.
   - iOS: `TinyTouchiOS/Sources/Services/IOSHapticsManager.swift` using `UIImpactFeedbackGenerator`, `UINotificationFeedbackGenerator`, and `UISelectionFeedbackGenerator`.

5. **Parental Shield**:
   - Continuous 3.0-second long-press with animated circular progress ring and haptic pulses (`ParentShieldButton.swift`).

---

## 3. Directory Structure

```
projects/tinytouch/
├── CLAUDE.md                                # This developer and agent guide
├── AGENTS.md -> CLAUDE.md                   # Symlink for Codex and other agents
├── backend.env, release.env                 # Monorepo declarations (no backend; cut_release.sh settings)
├── README.md                                # Public user-facing README
├── ToddlerPlay.xcodeproj/                   # Xcode project definition & schemes
│   ├── project.pbxproj                      # Project configuration (targets, build settings)
│   └── xcshareddata/xcschemes/              # Shared build schemes (TinyTouch, ToddlerPlay)
│
├── TinyTouchiOS/                            # iPhone Companion App Target
│   ├── Resources/
│   │   ├── Assets.xcassets/                 # 1024x1024 AppIcon, AccentColors
│   │   ├── PrivacyInfo.xcprivacy            # Apple Privacy Manifest (zero data collection)
│   │   └── Sounds/                          # Bundled WAV audio preview files
│   └── Sources/
│       ├── TinyTouchiOSApp.swift            # iOS @main entry point
│       ├── Services/
│       │   ├── IOSHapticsManager.swift      # UIKit tactile feedback engine
│       │   ├── IOSSettingsSyncManager.swift # WatchConnectivity sync manager & telemetry
│       │   └── IOSSoundManager.swift        # iOS preview audio player
│       └── Views/
│           ├── GamePreviewView.swift        # Interactive sandbox to test 5 sensory modes
│           ├── ParentDashboardView.swift    # Phone control dashboard & live telemetry
│           └── SafetyGuideView.swift        # Visual SOS/911 disable & Water Lock guide
│
├── ToddlerPlay/                             # watchOS Primary App Target
│   ├── Resources/
│   │   ├── Assets.xcassets/                 # watchOS AppIcon, AccentColors
│   │   ├── PrivacyInfo.xcprivacy            # Apple Privacy Manifest
│   │   └── Sounds/                          # 16 synthesized PCM WAV assets
│   └── Sources/
│       ├── ToddlerPlayApp.swift             # watchOS @main entry point
│       ├── Models/
│       │   └── GameMode.swift               # Game mode definitions, pedagogical notes, robust enum parser
│       ├── ViewModels/
│       │   └── AppState.swift               # Central state observable, session timer, telemetry counter
│       ├── Services/
│       │   ├── HapticsManager.swift         # Watch Taptic Engine patterns
│       │   ├── SessionKeeper.swift          # WKExtendedRuntimeSession keep-alive
│       │   ├── SoundManager.swift           # AVAudioPlayer pool & voice speech synthesizer
│       │   └── WatchConnectivityManager.swift # Watch WCSession listener & telemetry broadcaster
│       └── Views/
│           ├── MainContainerView.swift      # Root container, full-screen touch capture, Crown bindings
│           ├── Components/
│           │   └── ShapeViews.swift         # Reusable sensory vector shapes (stars, hearts, bubbles)
│           ├── Games/
│           │   ├── BubblePopView.swift      # Bubble pop mode + Crown inflation
│           │   ├── AnimalFriendsView.swift  # Animal sounds, peekaboo bounce, voice words
│           │   ├── SoundGardenView.swift    # Pentatonic chime bars (C, D, E, G, A, C5)
│           │   ├── SparkleCanvasView.swift  # Drag particle stardust + Crown galaxy
│           │   └── SleepyMoonView.swift     # Rest lullaby, smiling moon, music-box audio
│           └── ParentLock/
│               ├── ParentShieldButton.swift # 3-second hold gate with progress ring
│               ├── ParentDashboardView.swift # On-watch settings & mode selector
│               └── ParentGuideView.swift    # On-watch safety and Water Lock instructions
│
├── TinyTouchWidget/                         # watchOS Complication Widget Target
│   ├── Info.plist                           # Extension metadata
│   └── TinyTouchWidget.swift                # WidgetKit complication entry point
│
├── tools/                                   # Automation, Testing & Project Generation
│   ├── capture_screens.py                   # Automated simulator screenshot taker
│   ├── generate_project.py                  # Generates ToddlerPlay.xcodeproj from source trees
│   ├── generate_sounds.py                   # Pure-Python mathematical audio synthesizer for 16 WAVs
│   ├── release_testflight.sh                # Archive + TestFlight upload (CI: tinytouch-testflight.yml)
│   └── run_tests.swift                      # Standalone Swift test runner
│
├── metadata/                                # App Store Connect Submission Assets
│   ├── app_review_notes.txt                 # App Review reviewer guidelines & parental gate notes
│   ├── app_store_listing.md                 # Complete title, subtitle, keywords, marketing copy
│   ├── privacy_policy.md                    # Zero-data privacy policy document
│   └── screenshots/                         # Exact-pixel App Store screenshot sets
│       ├── watch_ultra_410x502/             # Apple Watch Ultra screenshots (410x502)
│       ├── watch_series9_396x484/           # Series 7-10 screenshots (396x484)
│       ├── iphone_6_7_1290x2796/            # iPhone 6.7" Pro Max screenshots (1290x2796)
│       ├── iphone_6_5_1284x2778/            # iPhone 6.5" Plus screenshots (1284x2778)
│       └── ipad_13_2048x2732/               # 13" iPad Pro screenshots (2048x2732)
│
├── docs/                                    # Developer overview on the monorepo's Pages site
└── site/                                    # Public Landing & Support Site (GitHub Pages)
    ├── index.html                           # Landing page
    ├── privacy.html                         # Public Privacy Policy
    ├── support.html                         # Public Support & Contact page
    └── assets/images/                       # App screenshots and logo
```

---

## 4. Build, Test, and Tooling Commands

### 1. Run Automated Unit Tests (Fast & Standalone)
The project includes a self-contained Swift test suite covering models, state management, timer expiry, enum parsing, sound assets, haptic configurations, and complication specifications:
```bash
swift tools/run_tests.swift
```
*Current status: 87/87 tests passing.*

### 2. Regenerate the Xcode Project
When files are added or deleted, or when project build configurations change, run the generator:
```bash
python3 tools/generate_project.py
```
> **IMPORTANT**: The script discovers and preserves the `DEVELOPMENT_TEAM` (default `68CTFST8W2`) and `MARKETING_VERSION` in `project.pbxproj`. Never overwrite the team ID; bump versions only through `scripts/cut_release.sh tinytouch`.

### 3. Build via Command Line (`xcodebuild`)
When building from terminal on macOS, point to the active Xcode toolchain:
```bash
# Set Developer Directory
export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"

# Build iOS Companion App (Embeds Watch App)
$DEVELOPER_DIR/usr/bin/xcodebuild build \
  -project ToddlerPlay.xcodeproj \
  -scheme TinyTouch \
  -destination 'generic/platform=iOS' \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO

# Build watchOS App Directly
$DEVELOPER_DIR/usr/bin/xcodebuild build \
  -project ToddlerPlay.xcodeproj \
  -scheme ToddlerPlay \
  -destination 'generic/platform=watchOS' \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO
```

### 4. Regenerate Sound Synthesis Assets
If sound WAV files need re-synthesizing from pure math:
```bash
python3 tools/generate_sounds.py
```
Outputs 16 lossless 44.1kHz 16-bit PCM WAVs to both `ToddlerPlay/Resources/Sounds/` and `TinyTouchiOS/Resources/Sounds/`.

---

## 5. Coding Conventions & Guardrails

### Swift & SwiftUI Standards
- **Swift Version**: 5.0.
- **State Management**: MVVM. The root observable object is `AppState` on watchOS and `IOSSettingsSyncManager` on iOS.
- **Declarative Navigation**: Avoid UIKit navigation stacks on watchOS. Use SwiftUI view conditional presentation (`if appState.showingParentMenu { ... }`).
- **No Force Unwraps**: Never force-unwrap optionals (`!`) in production code paths. Use `guard let` or `if let` with sensible fallbacks.

### Accidental-Touch Protection Guidelines
- **Always Intercept All Gestures**: Any interactive toddler view must capture gestures through `DragGesture(minimumDistance: 0)` with `.edgesIgnoringSafeArea(.all)` to prevent watchOS edge swipe handlers from triggering.
- **Digital Crown Handlers**: Digital Crown input should always be redirected to play interactions (glissandos, bubble inflation, galaxy rotations) using `.focusable()` and `.digitalCrownRotation(...)`.
- **Parent Gates**: Never provide simple 1-tap exit or settings buttons in the toddler views. All parental controls must use `ParentShieldButton` requiring a continuous 3-second hold.

### Pediatric Low-Stimulation Design Rules
- **No Rapid Animations**: Bubble floating and bouncing speeds must respect `appState.lowStimulation`.
- **Harmonic Consonance**: Musical notes must strictly follow the Pentatonic Scale (C4, D4, E4, G4, A4, C5). Never introduce minor seconds or tritones that could cause auditory distress.
- **Graceful End-of-Session Transitions**: When play timers expire, never cut the screen black abruptly. Always transition into the calm `SleepyMoonView` with soothing music-box lullaby.

### Privacy & App Store Compliance
- **Zero Data Collection**: No analytics SDKs, no tracking identifiers, no remote logging, no network requests other than local Bluetooth `WatchConnectivity` (TestFlight builds add opt-in FeedbackKit feedback, off by default; see "Feedback" above).
- **Encryption Exemption**: Always ensure `INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO` is set across all targets to exempt the app from US export compliance questionnaires.
- **Made for Kids**: Adhere to Apple's strict Kids category guidelines (no outside links without parental gate, no ads, no third-party libraries).

### Deployment & CI/CD Rules
- **TestFlight Releases**: `scripts/cut_release.sh tinytouch` from the monorepo root publishes a `tinytouch-v<version>` release; `.github/workflows/tinytouch-testflight.yml` archives the universal app (iOS + embedded watchOS + Widget) and uploads it (also weekly, and from the Actions tab). See "In the HEJI monorepo" above.
- **CI Secrets**: the team-wide HEJI signing secrets of the monorepo; nothing to provision per project.
- **Preserve Team Settings**: Team ID must remain `68CTFST8W2` (`HEJI TECHNOLOGY LLC`).
