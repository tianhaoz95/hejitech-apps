# Tether — Phone-to-Monitor Tiling Desktop Workspace

Tether is a self-contained desktop workspace app that runs on **iOS 17+** (`apps/ios/`) and **Android 13+ / API 33+** (`apps/android/`) and outputs a desktop-friendly tiling split-pane workspace to a USB-C external monitor (with a companion Cloudflare Worker web simulator & OAuth 2.1 MCP server in `services/web/`).

---

## 1. What Tether Is — and What It Is Not

### What It Is
- A **tiling split-pane desktop shell** (binary split tree up to 4 simultaneous panes, draggable split dividers clamped to `[0.2, 0.8]`, temporary pane maximise, and 4 built-in layout presets that redistribute open tabs without loss).
- Built around **only three built-in tools**:
  1. **Browser (`web`)**: Native `WKWebView` (iOS) / `android.webkit.WebView` (Android) per tab, desktop user-agent by default, shared cookie/session store across tabs, Back/Forward/Reload/Stop + URL/search address bar, `target="_blank"` opening a new tab in the same pane, and downloads saved to `Documents/Downloads`.
  2. **SSH-Only Terminal (`ssh`)**: 256-color `xterm-256color` terminal emulator with alternate screen buffer (`vim`, `htop`, `less`, `tmux`), ≥10,000-line scrollback, dynamic PTY `window-change` on pane resize, mandatory SHA-256 host key verification (`FirstConnect` prompt + `ChangedWarning` high-severity MITM alert), multi-line paste confirmation, and Keychain/Keystore SSH key generation & import.
  3. **Files (`files`)**: Dual-mode (`local` and `sftp`) directory browser sorted directories-first, alphabetical case-insensitive, chunked pagination for >500 entries, text/HTML preview in a Web tab, upload/download with >1MB progress & cancellation, and **"Insert path into focused terminal"** (inserting shell-escaped path text without executing).

### What It Is Not (Explicit Non-Goals — PRD §3)
- **No local shell or Linux container**: Tether never runs a local shell, `proot`, or local compilers on the phone. Every terminal session is an SSH session to a remote host.
- **No floating/overlapping windows**: Strictly tiled panes (plus temporary single-pane maximise).
- **No secret cloud sync**: SSH private keys, key passphrases, and host passwords live exclusively in on-device Keychain (iOS) or Android Keystore (Android) and are rejected by automated validators if present in any JSON payload.

---

## 2. Supported Hardware Setup (v1 Mirror Mode)

- **Phone**: iPhone with USB-C DisplayPort Alt Mode running iOS 17.0+, or Android phone with USB-C DisplayPort Alt Mode running Android 13 (API 33)+.
- **Hub / Display**: USB-C hub or direct USB-C / HDMI / DisplayPort cable connected to a 16:9 or 16:10 external monitor (1080p / 1440p / 4K).
- **Peripherals**: Bluetooth or USB hardware keyboard and mouse/trackpad connected to the phone.
- **Display Mode**: In v1, Tether operates in **landscape screen-mirroring mode** when an external monitor is attached. When no external monitor is attached (or on a narrow phone viewport <600pt), a compact **pane-switcher strip** appears at the top so all panes, hosts, keys, and settings remain usable on the phone screen itself.

---

## 3. Build & Install Instructions

### Shared Core & Cloudflare Worker (`packages/core`, `services/web`)
```sh
npm install
npm run typecheck:tether
npm run test:tether
WEB_ALLOW_LOCAL=1 npm run build:tether
```

### iOS App (`apps/ios/`)
1. Run unit tests for `TetherKit` on macOS:
   ```sh
   swift test --package-path projects/tether/apps/ios/TetherKit
   ```
2. Generate `Tether.xcodeproj` with XcodeGen and build for Simulator or a connected iPhone:
   ```sh
   cd projects/tether/apps/ios
   xcodegen generate
   xcodebuild -project Tether.xcodeproj -scheme App -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO build
   ```
3. To install on an attached physical iPhone (`xcrun devicectl list devices`), open `projects/tether/apps/ios/Tether.xcodeproj` in Xcode, select team `68CTFST8W2` (automatic signing with existing Apple Development identity), and run the `App` scheme.

### Android App (`apps/android/`)
1. Run `:core` JUnit tests and assemble the debug APK (requires JDK 17 and Android SDK 35):
   ```sh
   JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk \
     ./projects/tether/apps/android/gradlew -p projects/tether/apps/android :core:test :app:assembleDebug
   ```
2. Install on a connected Android device or emulator:
   ```sh
   adb install -r projects/tether/apps/android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 4. Library Choices & Licences (PRD §2.3, §2.4, §18.2)

| Component | Platform | Implementation / Library | Licence | Notes |
|---|---|---|---|---|
| Tiling Pane Shell | iOS | `UIKit` (`TilingWorkspaceViewController`) + `SwiftUI` sheets | System SDK | Direct responder chain & `UIKeyCommand` control |
| Tiling Pane Shell | Android | Jetpack Compose + `AndroidView` (`MainActivity`) | Apache-2.0 | Hosts native `WebView`, SSH terminal, and Files views |
| Web Browser | iOS / Android | `WebKit.WKWebView` / `android.webkit.WebView` | System SDK | Independent instance per Web tab, desktop UA |
| Terminal & SSH Engine | iOS | `TetherKit.TerminalEmulatorBuffer` + `CryptoKit` / `Security` | MIT / System | Self-contained `xterm-256color` VT100 parser (256-color SGR, alternate screen `DECSET 1049`, 10,000-line scrollback, Ed25519 keygen, SHA-256 host key verification) avoiding fragile third-party C/NIO build breakages |
| Terminal & SSH Engine | Android | `com.hejitech.tether.core` + `AndroidKeyStore` (`AES/GCM/NoPadding`) | Apache-2.0 | Keystore-backed RSA/Ed25519 key management, SHA-256 host key verification, `SshForegroundService` |
| Serialization & HTTP | Android | `kotlinx-serialization-json` (1.7.3), `okhttp` (4.12.0) | Apache-2.0 | Shared workspace JSON & Worker sync |
| Worker & MCP | Web | `@modelcontextprotocol/sdk`, `zod`, `vite`, `wrangler` | MIT / Apache-2.0 | OAuth 2.1 + `ttr_` personal access tokens |

---

## 5. Keyboard Shortcut Reference (PRD §13.1)

| Action | Default Shortcut (External Keyboard) | iOS Equivalent |
|---|---|---|
| Split focused pane horizontally (left / right) | `Ctrl + Alt + \` | `Cmd + Option + \` |
| Split focused pane vertically (top / bottom) | `Ctrl + Alt + -` | `Cmd + Option + -` |
| Close focused pane | `Ctrl + Alt + W` | `Cmd + Option + W` |
| Focus pane Left / Right / Up / Down | `Ctrl + Alt + Arrow Keys` | `Cmd + Option + Arrow Keys` |
| Cycle focus to next pane | `Ctrl + Alt + ]` | `Cmd + Option + ]` |
| Toggle maximise focused pane | `Ctrl + Alt + Enter` | `Cmd + Option + Enter` |
| Swap focused pane with next pane | `Ctrl + Alt + S` | `Cmd + Option + S` |
| Resize split divider ±5% | `Ctrl + Alt + [` / `]` | `Cmd + Option + [` / `]` |
| Apply layout preset 1…4 | `Ctrl + Alt + 1…4` | `Cmd + Option + 1…4` |
| New tab in focused pane | `Ctrl + T` | `Cmd + T` |
| Close active tab in focused pane | `Ctrl + W` *(when not in SSH tab)* | `Cmd + W` |
| Next / Previous tab in focused pane | `Ctrl + Tab` / `Ctrl + Shift + Tab` | `Ctrl + Tab` / `Ctrl + Shift + Tab` |
| Focus address bar (Web tab) | `Ctrl + L` *(when in Web tab)* | `Cmd + L` |
| Reload page (Web tab) | `Ctrl + R` *(when in Web tab)* | `Cmd + R` |
| Open Host List / Quick Connect | `Ctrl + Shift + H` | `Cmd + Shift + H` |
| Open Settings | `Ctrl + ,` | `Cmd + ,` |

---

## 6. Display-Host Isolation for Future External-Window Mode (PRD §4, §12)

All window/scene and external monitor detection logic is strictly isolated into a single file per platform:
- **iOS**: `projects/tether/apps/ios/App/Sources/DisplayHost.swift` (`DisplayHost` singleton observing `UIScene.willConnectNotification` / `UIScene.didDisconnectNotification` and locking landscape geometry via `UIWindowScene.GeometryPreferences.iOS`).
- **Android**: `projects/tether/apps/android/app/src/main/java/com/hejitech/tether/app/DisplayHostController.kt` (`DisplayHostController` implementing `DisplayManager.DisplayListener` and locking `ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE`).

Neither `TilingWorkspaceViewController` nor any tool tab (`Web`, `SSH`, `Files`) queries `UIScreen` or `DisplayManager` directly. Upgrading v2 to render an independent workspace on a secondary `UIWindowScene` (iOS) or `Presentation` / secondary `Activity` (Android) requires changes only inside `DisplayHost.swift` and `DisplayHostController.kt`.

---

## 7. Input Precedence & Platform Notes (PRD §13.2)

- **Terminal Ctrl-key pass-through**: When an SSH terminal tab is focused, single-modifier `Ctrl+C`, `Ctrl+D`, `Ctrl+Z`, `Ctrl+R`, `Ctrl+A`, `Ctrl+E`, `Ctrl+K`, `Ctrl+U`, `Ctrl+W`, and `Ctrl+L` are intercepted with `wantsPriorityOverSystemBehavior = true` on iOS (`TilingWorkspaceViewController.keyCommands`) and `dispatchKeyEvent` on Android (`MainActivity.kt`) and routed directly to the active terminal session rather than closing tabs or focusing the browser bar.
- **Scroll-wheel routing**: Scrolling inside an unfocused pane focuses and scrolls that pane without losing the active tab state in other panes.
