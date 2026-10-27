# Architecture & Design Decisions

## 1. Scope & Non-Goals (PRD §3)

- **Three built-in tools only**: `web` (Browser), `ssh` (SSH-only Terminal), and `files` (Local + SFTP File Browser).
- **No local shell**: Neither iOS nor Android spawns a local shell, Linux container, or `proot`. Every terminal session connects to a remote SSH server configured by the user.
- **Mirror mode in v1 with isolated `DisplayHost`**: Both iOS (`DisplayHost.swift`) and Android (`DisplayHostController.kt`) isolate all window/scene/display APIs in a single file so v1 runs reliably over USB-C DisplayPort Alt Mode screen mirroring in landscape while keeping a clean seam for future independent external-window mode.

## 2. Security & Secret Isolation (PRD §14)

- **Secrets never leave device hardware-backed storage**:
  - **iOS**: SSH private keys, key passphrases, remembered host passwords, and `known_hosts` fingerprints are stored in the iOS Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`).
  - **Android**: Encrypted with an AES-256-GCM master key stored in the Android Keystore (`AndroidKeyStore`).
- **Automated secret rejection**: `@tether/core`, `TetherKit`, and `:core` scan every JSON payload for forbidden keys (`password`, `passphrase`, `privateKey`, `privateKeyPEM`, `secretKey`) and reject any workspace or host payload containing secret material before disk persistence or cloud sync.

## 3. Input Precedence & Terminal Pass-Through (PRD §13.2)

- When an SSH terminal tab is focused, single-modifier control sequences (`Ctrl+C`, `Ctrl+D`, `Ctrl+Z`, `Ctrl+R`, `Ctrl+A`, `Ctrl+E`, `Ctrl+K`, `Ctrl+U`, `Ctrl+W`, `Ctrl+L`) are routed directly to the active terminal PTY instead of triggering application-level tab/window shortcuts.
- Pane management shortcuts use `Ctrl+Alt+<Key>` (`Cmd+Option+<Key>` on iOS) so they never collide with terminal or web page shortcuts.
