# AGENTS.md — Developer & Agent Guide for TinyTouch

Welcome to the **TinyTouch** (formerly ToddlerPlay) repository. This document serves as the single source of truth for AI agents and human contributors working on this codebase.

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
- **Current Marketing Version**: `1.5`
- **Current Build Number**: `7`
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
watch_game/
├── AGENTS.md                                # This developer and agent guide
├── CLAUDE.md -> AGENTS.md                   # Symlink for Claude Code compatibility
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
│   └── run_tests.swift                      # Standalone Swift test runner (80/80 passing tests)
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
└── docs/                                    # Public Landing & Support Site (GitHub Pages)
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
*Current status: 80/80 tests passing.*

### 2. Regenerate the Xcode Project
When files are added or deleted, or when project build configurations change, run the generator:
```bash
python3 tools/generate_project.py
```
> **IMPORTANT**: The script dynamically discovers and preserves whatever `DEVELOPMENT_TEAM` is configured in `project.pbxproj` (or defaults to `68CTFST8W2`). Never overwrite this team ID.

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
- **Zero Data Collection**: No analytics SDKs, no tracking identifiers, no remote logging, no network requests other than local Bluetooth `WatchConnectivity`.
- **Encryption Exemption**: Always ensure `INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO` is set across all targets to exempt the app from US export compliance questionnaires.
- **Made for Kids**: Adhere to Apple's strict Kids category guidelines (no outside links without parental gate, no ads, no third-party libraries).

### Deployment & CI/CD Rules
- **Automated TestFlight Releases via GitHub Actions**: The repository uses `.github/workflows/testflight-release.yml` to automatically run the unit tests, archive the universal app (iOS + embedded watchOS + Widget), and upload builds to TestFlight upon push to `main`, release tags (`v*`), or via manual `workflow_dispatch`.
- **CI Secrets Provisioning**: Secrets are provisioned and updated using `python3 tools/upload_ci_secrets.py` via the `gh` CLI. Secrets include the Apple Distribution certificate (.p12), keychain passwords, App Store Connect API Key (`AuthKey_4GZ563TKJ9.p8`), Issuer ID, and Team ID.
- **Manual / Local Distribution**: Developers can also build/archive locally from Xcode's **Organizer** window (`Product` > `Archive` > `Distribute App`).
- **Preserve Team Settings**: Team ID must remain `68CTFST8W2` (`HEJI TECHNOLOGY LLC`).
