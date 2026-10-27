# Tether

A self-contained tiling split-pane desktop workspace for iOS 17+ (`apps/ios/`) and Android 13+
(`apps/android/`) designed for USB-C external monitors, plus a Cloudflare Worker web workspace
and OAuth 2.1 MCP server (`services/web/`).

## Layout

- `packages/core/` (`@tether/core`): Normative binary split-pane tree engine (max 4 panes, split
  ratio clamping `0.2–0.8`, 4 layout presets preserving all open tabs), tab lifecycle, terminal grid
  calculator, multi-line paste detector, keyboard shortcut catalog, and PRD §14 secret-key rejection.
- `services/web/` (`@tether/web`): Cloudflare Worker serving the web workspace simulator (`/`),
  sign-in (`/login`), OAuth 2.1 consent (`/oauth/consent`), settings & token management (`/settings`),
  REST API (`/api/*`), and Streamable HTTP MCP server (`/mcp`, `ttr_` personal access tokens).
- `apps/ios/`:
  - `TetherKit/`: Swift package mirroring `@tether/core`, `Backend.swift`, `SecureStore.swift`
    (iOS Keychain for SSH keys, passwords, passphrases, and `known_hosts` SHA-256 fingerprints),
    and `SshTerminalEngine.swift` (`xterm-256color` VT100 buffer with alternate screen & 10,000-line
    scrollback).
  - `App/`: UIKit tiling container (`TilingWorkspaceViewController.swift`), isolated display host
    (`DisplayHost.swift`), `WebTabViewController.swift` (`WKWebView`), `SshTabViewController.swift`,
    `FilesTabViewController.swift` (Local `Documents` + `UIDocumentPicker` and SFTP), and SwiftUI
    sheets (`SheetsAndSettingsViews.swift`, `WhatsNewView.swift`).
- `apps/android/`:
  - `:core` (`com.hejitech.tether.core`): Kotlin shared models, `TetherBackend.kt`, and
    `SecureCredentialStore.kt` (Android Keystore AES-GCM encrypted store).
  - `:app` (`com.hejitech.tether.app`): `DisplayHostController.kt`, `SshForegroundService.kt`
    (persistent notification with "Disconnect All"), and `MainActivity.kt` (tiling split-pane UI
    hosting native `android.webkit.WebView`, SSH terminal, and Local/SAF/SFTP Files).

## Commands

```sh
npm run typecheck:tether
npm run test:tether
WEB_ALLOW_LOCAL=1 npm run build:tether
swift test --package-path projects/tether/apps/ios/TetherKit
(cd projects/tether/apps/ios && xcodegen generate)
xcodebuild -project projects/tether/apps/ios/Tether.xcodeproj -scheme App -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO build
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./projects/tether/apps/android/gradlew -p projects/tether/apps/android :core:test :app:assembleDebug
```

## Non-Negotiable Rules

1. **Three tools only**: `web`, `ssh`, and `files`. Never add a local shell, code editor, or window
   manager floating mode.
2. **Strict secret isolation (PRD §14)**: Passwords, key passphrases, and SSH private keys live only
   in on-device Keychain/Keystore and are rejected by `@tether/core`, `TetherKit`, and `:core` if
   present in any JSON payload.
3. **What's New before release**: `projects/tether/apps/ios/App/Sources/WhatsNewView.swift` must have
   `currentVersion` matching `MARKETING_VERSION` in `projects/tether/apps/ios/project.yml`.
