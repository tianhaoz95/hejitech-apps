# TinyTouch 🧸 (ToddlerPlay for watchOS)

A child-development play experience and accidental-touch shield designed specifically for parents holding an 18-month-old toddler with an Apple Watch, paired with an iPhone companion remote.

<p align="center">
  <a href="https://github.com/tianhaoz95/TinyTouch/actions/workflows/testflight-release.yml">
    <img src="https://github.com/tianhaoz95/TinyTouch/actions/workflows/testflight-release.yml/badge.svg" alt="TestFlight Release Status">
  </a>
  <a href="https://github.com/tianhaoz95/TinyTouch/actions/workflows/pages.yml">
    <img src="https://github.com/tianhaoz95/TinyTouch/actions/workflows/pages.yml/badge.svg" alt="Deploy GitHub Pages Status">
  </a>
  <a href="https://apps.apple.com/us/app/tinytouch-toddler-lock-play/id6809942800">
    <img src="https://img.shields.io/badge/App_Store-Ready_for_Sale-34C759?logo=apple&logoColor=white" alt="App Store Status">
  </a>
</p>

<p align="center">
  <a href="https://apps.apple.com/us/app/tinytouch-toddler-lock-play/id6809942800" target="_blank">
    <img src="docs/assets/images/app_store_badge.svg" alt="Download on the App Store" height="52">
  </a>
</p>

<div align="center">

| 📱 Scan with iPhone to Download | 🎬 App Store Connect Promo Video |
| :---: | :---: |
| <a href="https://apps.apple.com/us/app/tinytouch-toddler-lock-play/id6809942800"><img src="docs/assets/images/app_store_qr.png" width="180" alt="App Store QR Code" /></a><br><sub><a href="https://apps.apple.com/us/app/tinytouch-toddler-lock-play/id6809942800"><b>View on App Store ↗</b></a></sub> | <video src="docs/assets/videos/app-store-connect-promo-video.mp4" poster="docs/assets/images/video_poster.jpg" width="190" controls loop muted playsinline></video><br><sub><a href="docs/assets/videos/app-store-connect-promo-video.mp4"><b>Watch Promo Video (MP4)</b></a></sub> |

</div>

---

## 🌟 The Core Problem & The Dual Solution

When holding a one-and-a-half-year-old toddler, their hands naturally reach for whatever is glowing on your wrist. On standard watchOS:
- Random taps hit watch face complications that dial recent phone numbers or emergency SOS.
- Swiping down pulls Notification Center; swiping up / side button opens Control Center.
- Turning the Digital Crown scrolls away into Smart Stack.
- Short screen timeouts turn the display black within seconds, triggering toddler frustration.

**TinyTouch provides a dual solution:**
1. **Accidental-Touch Shield ("Toddler Lock")**: Captures 100% of edge-to-edge screen interactions. Disables system navigation bars, dismiss gestures, and complication triggers. Tames the Digital Crown so turning it acts as an interactive musical toy rather than scrolling out of the app. Returning to settings requires a continuous **3-second hold** on a discreet Parent Shield with animated countdown and haptic feedback—something an 18-month-old cannot do.
2. **Developmentally Grounded Play (18-Month Focus)**: Designed according to pediatric developmental principles (AAP low-stimulation recommendations). No fast flashing, no predatory reward loops, no losing states. Delivers immediate cause-and-effect auditory chimes (pentatonic scale), gentle tactile haptics, friendly animal speech recognition, and a calm bedtime lullaby transition when the session ends.

---

## 🎮 The 5 Toddler Play Modes

### 1. 🫧 Bubble Pop (Motor Coordination & Cause-and-Effect)
- Gentle floating translucent bubbles with glowing rims and cute shapes (Stars, Hearts, Circles).
- Tapping any bubble bursts it with an authentic bubble pop sound, expanding particle rings, and tactile pops.
- Tapping empty space spawns a brand new bubble right under their finger.
- Turning the **Digital Crown** inflates a giant centerpiece bubble until it pops into rainbow confetti!

### 2. 🐶 Animal Friends & Peekaboo (Speech & Language Discovery)
- High-contrast, expressive animal characters (Puppy, Kitty, Duck, Cow, Frog, Bunny).
- Tapping an animal makes them do a springy squish/bounce animation with floating hearts.
- Plays characteristic animal sounds (Woof, Meow, Quack, Moo, Ribbit).
- Spoken voice cues ("Duck! Quack quack!") support early speech mimicry and word association.
- Digital Crown spins the animal carousel with mechanical click haptics.

### 3. 🎹 Sound Garden / Xylophone (Harmonic Sensory & Rhythm)
- 6 colorful vertical chime bars (Do, Re, Mi, Sol, La, Do).
- Uses the **Pentatonic Scale (C, D, E, G, A, C5)**: mathematically consonant and impossible to create harsh or discordant notes—every random tap sounds like a harmonious melody.
- Tapping or sliding fingers lights up bars with vertical ripples and plays glockenspiel chimes.
- Turning the Digital Crown performs a sweeping musical glissando.

### 4. ✨ Magic Sparkles (Free Motor & Sensory Exploration)
- Pure open OLED-black canvas.
- Drags leave glowing rainbow stardust and sparkling chime cascades.
- Accommodates whole-palm slaps and multi-finger explorations without errors or menus.
- Crown rotation creates a spinning kaleidoscope galaxy in the center.

### 5. 🌙 Sleepy Moon Lullaby (Calm Transition & Bedtime Wind-Down)
- Deep midnight sky with soft twinkling stars and a gentle smiling crescent moon.
- Plays a soothing music box melody (*Twinkle Twinkle* motif).
- Tapping the moon gently brightens its blushing cheeks with a soft pulse.
- **Tear-Free Transitions**: Automatically activates when the Parent Play Timer expires, signaling to the toddler that it is "time to rest" rather than an abrupt screen cutoff.

---

## 🛡️ Parental Controls & Safety Features

- **Parent Shield (3-Second Hold Gate)**:
  Positioned in the top-left corner. Holding for 3 continuous seconds fills a progress ring with rhythmic haptic ticks. If released early, it resets immediately.
- **Session Play Timer**:
  Configure 3 min, 5 min, 10 min, or unlimited play. When the timer ends, the app gently transitions to the Sleepy Lullaby mode.
- **Sensory Toggles**:
  Toggle Sound Effects, Spoken Words, Taptic Engine pulses, and Low-Stimulation mode (slows movement speeds and mutes contrast).
- **Co-Play Prompts**:
  Displays rotating caregiver prompts (e.g., *"What sound does the duck make? Quack quack!"*) to foster parent-child interaction while holding the toddler.
- **Water Lock & Guided Access Integration**:
  Built-in guide explaining how parents can activate watchOS Water Lock (swipe Control Center -> Water Droplet) if they want 100% hardware touch lockdown while the child watches the screen.

---

## 🛠️ Project Architecture (Universal iOS + watchOS)

```
watch_game/
├── TinyTouchiOS/                       # iPhone Parent Companion Target
│   ├── Sources/
│   │   ├── TinyTouchiOSApp.swift       # iOS @main entry point
│   │   ├── Views/
│   │   │   ├── ParentDashboardView.swift # iPhone safety dashboard & status
│   │   │   ├── SafetyGuideView.swift     # Visual 911/SOS lock & Water Lock guide
│   │   │   └── GamePreviewView.swift     # Interactive sandbox to test 5 sensory modes
│   │   └── Services/
│   │       ├── IOSSoundManager.swift     # Low-latency preview audio pool
│   │       └── IOSHapticsManager.swift   # UIImpactFeedback tactile responses
│   └── Resources/
│       ├── Assets.xcassets/            # 1024x1024 iOS AppIcon & AccentColor
│       ├── PrivacyInfo.xcprivacy       # Privacy Manifest (Zero tracking declared)
│       └── Sounds/                     # 16 preview WAV sound effects
├── ToddlerPlay/                        # Apple Watch Target (Embedded in iOS bundle)
│   ├── Sources/
│   │   ├── ToddlerPlayApp.swift        # Watch @main entry point
│   │   ├── Models/GameMode.swift       # 5 game definitions & pedagogical metadata
│   │   ├── Services/
│   │   │   ├── SoundManager.swift      # Zero-latency AVAudioPlayer pool & voice synth
│   │   │   ├── HapticsManager.swift    # Taptic Engine semantic feedback patterns
│   │   │   └── SessionKeeper.swift     # WKExtendedRuntimeSession keep-alive
│   │   ├── ViewModels/AppState.swift   # Central state, session timer & mode transition
│   │   └── Views/
│   │       ├── MainContainerView.swift # Full-screen canvas & parent shield
│   │       ├── ParentLock/             # 3-sec hold gate, dashboard, safety guide
│   │       └── Games/                  # Bubbles, Animals, Sound Garden, Sparkles, Lullaby
│   └── Resources/
│       ├── Assets.xcassets/            # watchOS AppIcon & AccentColor
│       ├── PrivacyInfo.xcprivacy       # Privacy Manifest
│       └── Sounds/                     # 16 synthesized 16-bit 44.1kHz PCM WAVs
├── tools/
│   ├── generate_project.py             # Generates Xcode project with iOS + embedded Watch
│   ├── release.py                      # Automated App Store Connect archive & uploader
│   ├── release.sh                      # Quick one-step release launcher
│   └── run_tests.swift                 # 51/51 automated unit tests
├── metadata/                           # App Store listing, Privacy Policy & Review Notes
└── screenshots/                        # High-resolution screenshots for Watch & iPhone
```

---

## 🚀 Building & Running

### From the Command Line
```bash
# 1. Run unit tests
swift tools/run_tests.swift

# 2. Build for iPhone Simulator
xcodebuild -scheme TinyTouch -destination 'platform=iOS Simulator,name=iPhone 17 Pro' CODE_SIGNING_ALLOWED=NO build

# 3. Build for Apple Watch Simulator
xcodebuild -scheme ToddlerPlay -destination 'platform=watchOS Simulator,name=Apple Watch Ultra 3 (49mm)' CODE_SIGNING_ALLOWED=NO build

# 4. Dry-run archive verification
python3 tools/release.py --dry-run
```

---

## 📦 App Store Connect Setup & Release

### Why is there no "watchOS" platform option in App Store Connect?
In App Store Connect, Apple distributes all Apple Watch apps through the **iOS** platform umbrella. There is no standalone "watchOS" checkbox on the New App creation modal. 

When you create the app record:
1. Platform: Check **iOS**.
2. Bundle ID: Select `com.tianhaoz.tinytouch`.
3. Uploading `TinyTouch` uploads the iPhone Companion App with the Apple Watch app (`com.tianhaoz.tinytouch.watchkitapp`) seamlessly embedded inside.
4. When parents download TinyTouch on their iPhone, it automatically installs the game onto their paired Apple Watch!

### Automated CI/CD TestFlight Release (GitHub Actions)

[![TestFlight Release](https://github.com/tianhaoz95/TinyTouch/actions/workflows/testflight-release.yml/badge.svg)](https://github.com/tianhaoz95/TinyTouch/actions/workflows/testflight-release.yml)
[![Deploy GitHub Pages](https://github.com/tianhaoz95/TinyTouch/actions/workflows/pages.yml/badge.svg)](https://github.com/tianhaoz95/TinyTouch/actions/workflows/pages.yml)

The repository includes a GitHub Actions workflow (`.github/workflows/testflight-release.yml`) that automatically runs tests, creates a universal signed archive (iOS + embedded watchOS + Widget), and uploads directly to TestFlight.

- **Automatic Trigger**: Pushing to `main` or pushing a version tag (e.g., `git tag v1.4 && git push origin v1.4`).
- **Manual Trigger**: Via GitHub Actions UI (**Actions** > **TestFlight Release** > **Run workflow**), with optional dry-run and custom build number.
- **Sync / Re-provision Secrets**:
  ```bash
  python3 tools/upload_ci_secrets.py
  ```

---

## 🌐 Live Website & Links

* **App Store**: [https://apps.apple.com/us/app/tinytouch-toddler-lock-play/id6809942800](https://apps.apple.com/us/app/tinytouch-toddler-lock-play/id6809942800)
* **Landing Page**: [https://tianhaoz95.github.io/TinyTouch/](https://tianhaoz95.github.io/TinyTouch/)
* **Support & Parent FAQ**: [https://tianhaoz95.github.io/TinyTouch/support.html](https://tianhaoz95.github.io/TinyTouch/support.html)
* **Privacy Policy**: [https://tianhaoz95.github.io/TinyTouch/privacy.html](https://tianhaoz95.github.io/TinyTouch/privacy.html)

