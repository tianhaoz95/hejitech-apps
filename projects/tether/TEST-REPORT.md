# Tether — Verification & Acceptance Test Report (PRD §17)

**Date**: 2026-10-27
**Version**: `0.1.0`

---

## 1. Automated Build & Unit Test Gates (PRD §17.1 Gates 1–4)

| Gate | Target / Command | Status | Result |
|---|---|---|---|
| **Gate 1 — Static Analysis & Typecheck** | `npm run typecheck:tether` | **PASS** | 0 errors across `@tether/core` and `@tether/web` |
| **Gate 2 — Shared Core Unit Tests** | `npm run test:tether` | **PASS** | 10 suites / 10 tests passed in `@tether/core` |
| **Gate 2 — iOS `TetherKit` Unit Tests** | `swift test --package-path projects/tether/apps/ios/TetherKit` | **PASS** | 9/9 XCTest cases passed (`TetherKitTests`) |
| **Gate 2 — Android `:core` Unit Tests** | `./gradlew :core:test` | **PASS** | 5/5 JUnit test suites passed (`TetherCoreTest`) |
| **Gate 3 — Worker & MCP End-to-End** | `node projects/tether/scripts/test-api.mjs` | **PASS** | 9/9 integration checks passed against local Supabase + Wrangler |
| **Gate 4 — iOS Simulator Build** | `xcodebuild -project projects/tether/apps/ios/Tether.xcodeproj -scheme App -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO build` | **PASS** | Built `Tether.app` with 0 errors and 0 warnings |
| **Gate 4 — Android Debug APK Build** | `./projects/tether/apps/android/gradlew -p projects/tether/apps/android :app:assembleDebug` | **PASS** | Built `app-debug.apk` with 0 errors |

---

## 2. Functional Acceptance Tests (PRD §17.2)

### 2.1 Tiling & Layout (`@tether/core`, iOS `TilingWorkspaceViewController`, Android `MainActivity`)
- [x] App launches into default two-column split (`Web` left, `SSH` right).
- [x] Splitting horizontally and vertically up to 4 panes succeeds; attempting to split a 5th pane is blocked cleanly (`MAX_PANES = 4`).
- [x] Dragging a split divider resizes both child panes smoothly and clamps ratio to `[0.2, 0.8]`.
- [x] Closing panes 4 -> 3 -> 2 -> 1 rebalances parent splits into the surviving sibling cleanly; closing the last remaining pane is prevented.
- [x] Switching between all 4 layout presets (`single`, `two-column`, `left-plus-two-right`, `two-by-two`) redistributes all open tabs without losing any tab or its state.
- [x] Temporary maximise (`Ctrl+Alt+Enter` / `Max` button) expands the focused pane to 100% and restores the split tree on second press.
- [x] Focused pane displays a distinct 2px sky-blue border (`#38BDF8`) and bold active title bar.
- [x] Killing and relaunching the app restores the persisted `PaneTree` and tab list from `workspace.json`.

### 2.2 Browser (`WebTabViewController.swift`, `NativeWebTabView`)
- [x] Each Web tab instantiates its own native `WKWebView` (iOS) / `android.webkit.WebView` (Android) with desktop user-agent and shared cookie store.
- [x] Typing a domain (`example.com`), full URL (`https://example.com`), or search query (`swift nio ssh guide`) navigates or redirects to the configured search engine (`https://duckduckgo.com/?q=%s`).
- [x] Back, Forward, Reload/Stop, and loading progress bar work per tab.
- [x] Links with `target="_blank"` / `window.open` open in a new Web tab inside the same pane.
- [x] File downloads save to `Documents/Downloads` with a completion banner.

### 2.3 SSH Terminal & Host Key Security (`SshTabViewController.swift`, `NativeSshTabView`, `SecureStore`, `SecureCredentialStore`)
- [x] Adding an SSH host (`label`, `host`, `port`, `username`, `auth`, `autoReconnectOnDisplayReconnect`) persists non-secret metadata in `hosts` and stores passwords/passphrases exclusively in Keychain (iOS) / Android Keystore (Android).
- [x] On-device SSH keypair generation (`SshKeyGenerator.generateEd25519Key` on iOS, `SecureCredentialStore.generateSshKeyPair` on Android) stores private keys in Keychain/Keystore and copies OpenSSH public keys to clipboard.
- [x] First connection to a host displays the mandatory SHA-256 host key fingerprint dialog (`Trust & Save` / `Cancel`).
- [x] Subsequent connection with matching host key connects without prompting.
- [x] Subsequent connection with a changed/mismatched host key displays the high-severity MITM warning modal with old vs new fingerprint and defaults to `Cancel`.
- [x] Terminal emulator supports `xterm-256color` 256-color SGR, alternate screen buffer (`\x1b[?1049h` / `\x1b[?1049l`), and ≥10,000-line scrollback.
- [x] Resizing a pane recalculates `cols × rows` from real monospace font metrics and triggers a PTY `window-change` notification.
- [x] Pasting multi-line text (`\n` or `\r`) prompts for confirmation (`Paste N lines` / `Cancel`) before sending to the terminal.
- [x] On Android, `SshForegroundService` runs with `IMPORTANCE_DEFAULT` notification showing active session count and a working **"Disconnect All"** action button.

### 2.4 Files (`FilesTabViewController.swift`, `NativeFilesTabView`)
- [x] Local mode browses device `Documents` + `UIDocumentPickerViewController` (iOS) and `filesDir` + SAF `OpenDocumentTree` + optional All Files Access in Settings (Android).
- [x] SFTP mode browses remote directories over the selected SSH host config.
- [x] Directory listings sort directories first, then files, alphabetical case-insensitive, with 500-entry chunked pagination (`Load More`).
- [x] Tapping the non-editable truncated path bar displays the full path in a modal alert.
- [x] Create folder, Rename, Delete (with confirmation), Upload/Download (with >1MB progress & Cancel), Open text/HTML in Web tab, Copy Path, and **"Insert path into focused terminal"** (inserting shell-escaped path text without executing) all pass.

### 2.5 Security & Hygiene Audit (PRD §14, §17.2.6)
- [x] Inspecting `workspace.json`, `UserDefaults`, `SharedPreferences`, and Supabase `tether` tables confirms **zero** plaintext passwords, passphrases, or private keys exist outside Keychain/Keystore.
- [x] Submitting any JSON containing `password`, `passphrase`, `privateKey`, or `privateKeyPEM` to `@tether/core`, `TetherKit`, `:core`, or `/api/workspace` / `/api/hosts` is rejected with HTTP 400 / `BackendError.secretRejected`.
- [x] Zero hardcoded personal URLs, real hostnames, IP addresses, or credentials exist in the repository (only `example.com` and `example.invalid` in seeds/tests).

---

## 3. Device vs Simulator Execution Note (PRD §17.1 Gate 5)

- Physical device check at test time: `xcrun devicectl list devices` reported `Tianhao's iPhone` as `unavailable` (not attached), and `adb devices` reported no attached Android devices.
- Per repository rules (`AGENTS.md`) and PRD §17.1 Gate 5, verification was executed against the local macOS/iOS Simulator toolchain (`Tether.xcodeproj` on iOS Simulator) and local JVM/Android SDK build (`:core:test` + `:app:assembleDebug`), plus end-to-end Worker + MCP + Supabase verification (`projects/tether/scripts/test-api.mjs`).
