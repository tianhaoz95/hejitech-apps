# ToddlerCam: Dual Baby Camera & Watch Remote 📸⌚️

[![TestFlight Release](https://github.com/tianhaoz95/peekaboo-cam/actions/workflows/testflight-release.yml/badge.svg)](https://github.com/tianhaoz95/peekaboo-cam/actions/workflows/testflight-release.yml)

> **ToddlerCam** (`com.hejitech.kidscam`) is a child-friendly, privacy-focused iOS and watchOS dual-camera app tailored for toddlers and parents. It captures both the front and rear cameras simultaneously, features a parent Apple Watch remote control with attention-grabber animal sounds, includes an educational Guided Access toddler lock setup, and includes a dedicated Apple Watch Face & Complication Studio in the iPhone app.

---

## 🌟 Key Features

### 1. Dual Camera Capture (Front + Rear Together)
* **Simultaneous Multi-Cam Feed:** Powered by `AVCaptureMultiCamSession` on physical devices, rendering real-time front and rear camera views simultaneously.
* **Layout Mode:**
  * **Picture-in-Picture (PiP):** 100% full screen edge-to-edge camera feed with floating selfie bubble. Tap the bubble to swap primary and selfie cameras!
* **Dual Keepsake Photos:**
  * Generates a high-resolution composite photo (with cute rounded borders, date watermark, and active sticker overlays).
  * Automatically saves individual front and rear shots to the Apple Photos library.
* **Simulator & Fallback Engine:** Graceful fallback for simulator and older hardware with interactive toddler animations and realistic photo synthesis.

### 2. Toddler-Friendly & Child-Safe UI
* **Big Bouncy Shutter Button:** Chunky 86pt tactile button with animated press states and crisp haptic feedback.
* **Clean Toddler Screen (Zero Clutter):** No confusing emoji toolbars or settings buttons on the phone; the screen is locked and simplified so toddlers focus on holding and taking photos.
* **Native Apple Vision Face Tracking:** Emojis (🦁 Lion, 👑 Crown, 🕶️ Sunglasses, 🐱 Kitty, 🐶 Puppy, 🦄 Unicorn, 🐼 Panda, 🐰 Bunny, ⭐️ Star Eyes) automatically track the toddler's face in real-time using `VNDetectFaceLandmarksRequest`.
* **Toddler Screen Lock:** Replaces touch gestures with an interactive bubble popping canvas (🫧, ⭐, ❤️, 🎵). Tapping produces playful pop sounds without breaking the camera stream.
* **Parental Gate:** Access to Settings, Gallery, and Guided Access tutorials is secured behind a math challenge to prevent accidental toddler navigation.
* **Built-in Soundboard:** Playful synthesized sound effects (Shutter chime, Puppy bark, Kitty meow, Duck quack, Baby giggle, Clown horn, Spring boing).

### 3. Apple Watch Remote Control
* **Parent Remote on Apple Watch (`KidsCamWatch`):**
  * Control the camera and filters from your wrist while your toddler holds the phone!
  * **Face Masks Remote Settings:** Choose or clear face tracking masks (Crown, Lion, Sunglasses, etc.) from the watch while the phone remains safely locked in toddler hands.
  * **Wrist Shutter:** Big, tactile shutter button with watch haptics (`WKInterfaceDevice`).
  * **Silly Attention Grabbers:** Tap 🐶 Puppy Bark, 🦆 Duck Quack, 🐱 Kitten Meow, or 👶 Baby Giggle on the watch to make the iPhone blast that sound, getting your child to look up and smile!
  * **Remote Screen Lock:** Remotely toggle the toddler screen lock on the phone.
  * **Camera Swap:** Switch front / rear cameras from your watch.
  * **Last Photo Thumbnail Review:** Instantly inspect the captured photo on your wrist.

### 4. Guided Access Education & Settings Shortcut
* **Full Toddler Safe Mode:** Triple-clicking the side button locks the toddler into ToddlerCam, disabling home bar swipe gestures, notification center, control center, and volume/power buttons.
* **Direct Settings Link:** Opens the iOS Settings app directly to Accessibility.
* **Live Status Detection:** Utilizes `UIAccessibility.isGuidedAccessEnabled` and `guidedAccessStatusDidChangeNotification` to display a live security badge.
* **Visual 4-Step Parent Guide:** Illustrated tutorial explaining one-time setup and how to start/exit Guided Access safely.

### 5. Watch Face Studio & Complications in Phone iOS App
* **Complication Settings:**
  * Configure what action the watch face complication performs: Quick Shutter, Silly Sound, Full Remote, or Status.
  * Syncs complication data directly to the Apple Watch via `WCSession.default.transferCurrentComplicationUserInfo`.
  * Deep links directly to the Apple Watch app on iOS (`watch://`).
* **Toddler Photo Watch Face Creator:**
  * Pick any captured dual-camera photo from ToddlerCam or your photo library.
  * Live interactive Apple Watch mockup preview (chassis frame, digital time display, customizable colors, top/bottom time position).
  * Direct "Add to Apple Watch Face" action via iOS Share Sheet ("Create Watch Face" extension) and ClockKit photo formatting.

### 6. 100% Child Safe & COPPA Compliant
* Built strictly according to **Apple App Store Review Guidelines for the Kids Category (Guideline 1.3 & 5.1.4)** and **COPPA**.
* **Zero Data Collection:** No third-party SDKs, no tracking, no ads, no analytics.
* Everything runs 100% on-device and offline.

---

## 📁 Repository Structure

```
kids-cam/
├── project.yml                     # XcodeGen project specification
├── KidsCam/                        # iOS App Target
│   ├── App/
│   │   ├── KidsCamApp.swift        # Main App entry point
│   │   └── Info.plist              # Bundle info & camera/photo permissions
│   ├── Camera/
│   │   ├── DualCameraManager.swift # AVCaptureMultiCamSession & capture pipeline
│   │   ├── DualCameraPreviewView.swift # SwiftUI multi-cam preview layers
│   │   └── DualPhotoRenderer.swift # High-res dual photo compositor
│   ├── UI/
│   │   ├── ToddlerCameraView.swift # Primary toddler camera interface
│   │   ├── ParentHubView.swift     # Parent settings & navigation hub
│   │   └── Components/
│   │       ├── ToddlerControlBar.swift # Chunky control bar & shutter
│   │       ├── ToddlerLockOverlay.swift # Bubble popping safe touch canvas
│   │       ├── StickersOverlayView.swift # Silly animal/crown stickers
│   │       └── ParentGateView.swift # Child-proof math challenge
│   ├── GuidedAccess/
│   │   ├── GuidedAccessManager.swift # UIAccessibility status & settings link
│   │   └── GuidedAccessGuideView.swift # Visual parent educational tutorial
│   ├── WatchFace/
│   │   ├── WatchFaceManager.swift  # Complication sync & photo export
│   │   ├── WatchFaceMockupView.swift # Live Apple Watch chassis preview
│   │   └── WatchFaceStudioView.swift # Watch Face & Complication studio
│   ├── Gallery/
│   │   └── PhotoGalleryView.swift  # Dual photo review & sharing
│   ├── Connectivity/
│   │   └── WatchConnectivityManager.swift # WCSession phone-to-watch bridge
│   ├── Audio/
│   │   ├── SoundEffectManager.swift # Low-latency audio player & haptics
│   │   └── *.wav                   # Synthesized toddler sound effects
│   └── Resources/
│       └── Assets.xcassets/        # AppIcon and asset catalog
├── KidsCamWatch/                   # watchOS Target
│   ├── App/
│   │   ├── KidsCamWatchApp.swift   # Watch App entry point
│   │   └── Info.plist
│   ├── Remote/
│   │   ├── WatchSessionManager.swift # WCSession watch client
│   │   ├── WatchRemoteControlView.swift # Wrist shutter & remote controls
│   │   ├── SillySoundboardView.swift # Animal attention grabbers soundboard
│   │   └── WatchPhotoReviewView.swift # Wrist photo preview
│   └── Resources/
├── KidsCamWatchWidgets/            # WatchOS WidgetKit Complications Target
│   ├── KidsCamComplications.swift  # Circular, Rectangular, Corner complications
│   └── Info.plist
├── KidsCamTests/                   # iOS Unit Test Suite
│   └── KidsCamTests.swift          # Camera, WatchFace, Sounds, Renderer tests
├── AppStore/                       # Release Documentation & Assets
│   ├── APP_STORE_METADATA.md       # Complete App Store Connect submission fields
│   ├── PRIVACY_POLICY.md           # COPPA & Kids Category privacy policy
│   ├── ExportOptions.plist         # Release archive export settings
│   └── AppIcon-1024.png            # 1024x1024 App Store icon
└── Scripts/
    ├── build.sh                    # Automated build script for all targets
    ├── run_tests.sh                # Automated unit test suite runner
    ├── generate_sounds.py          # PCM audio synthesizer
    └── generate_icons.swift        # AppKit vector icon generator
```

---

## 🛠️ Build & Verification Instructions

### Prerequisites
* macOS with **Xcode 16+** (iOS 17+ SDK, watchOS 10+ SDK)
* **xcodegen** (`brew install xcodegen`)

### 1. Build the Complete Project
Run the automated build script:
```bash
./Scripts/build.sh
```
Or manually:
```bash
xcodegen generate
xcodebuild -project KidsCam.xcodeproj -scheme KidsCam -destination "generic/platform=iOS Simulator" build CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
xcodebuild -project KidsCam.xcodeproj -scheme KidsCamWatch -destination "generic/platform=watchOS Simulator" build CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
```

### 2. Run the Unit Test Suite
```bash
./Scripts/run_tests.sh
```

---

## 🚀 App Store Connect Release Guide
All required metadata, descriptions, keywords, age rating responses, and privacy policies have been prepared in:
- `AppStore/APP_STORE_METADATA.md`
- `AppStore/PRIVACY_POLICY.md`
- `AppStore/ExportOptions.plist`
- `AppStore/AppIcon-1024.png`

When you are ready to upload:
1. Create a new App in [App Store Connect](https://appstoreconnect.apple.com) with Bundle ID `com.hejitech.kidscam`.
2. Copy and paste the metadata from `AppStore/APP_STORE_METADATA.md`.
3. Set your Team ID in `project.yml` or Xcode Signing & Capabilities.
4. Archive and upload using Xcode Organizer or `xcodebuild -exportArchive`.
