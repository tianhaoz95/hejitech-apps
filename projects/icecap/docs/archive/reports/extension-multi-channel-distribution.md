# Extension Multi-Channel Distribution

This document covers the strategy, build pipeline, and Firebase configuration for distributing the Icecap Chrome Extension across all supported channels.

## Channels

| Channel | Target | Distributable | Notes |
|---|---|---|---|
| Chrome Web Store | `chrome-mv3` | `icecap-chrome.zip` | Standard Chrome extension submission |
| Edge Add-ons Store | `edge-mv3` | `icecap-edge.zip` | Same Chromium runtime; separate ID assigned by store |
| Safari (Mac App Store) | `safari-mv3` | Requires Xcode | Raw Plasmo output needs `xcrun safari-web-extension-converter` |
| Sideload (direct ZIP) | `chrome-mv3 --tag=sideload` | `icecap-sideload.zip` | Requires stable manifest key for consistent extension ID |

---

## Extension Identity Per Channel

The extension ID is determined differently per channel. It is **not** set at build time — it is either assigned by the store or derived from the manifest key for sideload installs.

### Chrome Web Store
Google assigns a permanent ID when you first publish. The ID does not change across updates to the same listing.

### Edge Add-ons Store
Microsoft assigns a separate ID. Although Edge runs Chrome extensions natively, the Edge Add-ons store assigns its own ID, distinct from the Chrome Web Store ID.

### Safari
Safari Web Extensions are identified by their **bundle ID** (e.g. `com.yourcompany.icecap`), set during Xcode project creation. The origin used for Firebase Auth is `safari-web-extension://<BUNDLE_ID>`.

### Sideload
Without a manifest `key`, Chrome generates a random ID per installation, making Firebase Auth authorization impossible. A stable ID requires adding a `key` field to the manifest:

**1. Generate a key:**
```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -outform der | openssl enc -base64 -A
```

**2. Add it to `apps/extension/package.json` under `manifest`:**
```json
"manifest": {
  "key": "<base64-encoded-public-key>",
  ...
}
```

The public key in the manifest is safe to commit — it is not a secret. Once set, the extension ID is stable and can be pre-authorized in Firebase.

> The `build:sideload` script (`--tag=sideload`) outputs to a separate directory (`chrome-mv3-sideload/`) so sideload and Chrome Web Store builds do not overwrite each other.

---

## Build Pipeline

### Adding Channels to the Build

Per-channel scripts are defined in `apps/extension/package.json`:

```bash
# Build (no source maps)
pnpm --filter @icecap/extension build:chrome
pnpm --filter @icecap/extension build:edge
pnpm --filter @icecap/extension build:safari
pnpm --filter @icecap/extension build:sideload

# Package (produces .zip)
pnpm --filter @icecap/extension package:chrome
pnpm --filter @icecap/extension package:edge
pnpm --filter @icecap/extension package:safari   # raw bundle — Xcode still required
pnpm --filter @icecap/extension package:sideload
```

### Build All Channels at Once

```bash
./scripts/build-extension-all.sh
```

Options:
- `--skip-safari` — skip Safari build (if Xcode not available)
- `--skip-sideload` — skip sideload build (if manifest key not yet set)

Output zips are collected in `dist/extension/`.

---

## Extension ID at Runtime

The extension never needs to know its own ID at build time. Use the Chrome API for any self-referential URL:

```ts
const extensionId = chrome.runtime.id
const optionsUrl = chrome.runtime.getURL('options.html')
```

---

## Firebase Authentication — Authorized Origins

Firebase Auth uses the requesting page's origin to validate sign-in. For extensions, the origin is `chrome-extension://<ID>` (or `safari-web-extension://<BUNDLE_ID>` for Safari).

### Setup (Firebase Console)

1. Go to **Firebase Console → Authentication → Settings → Authorized domains**
2. Add one entry per channel after obtaining each ID:

| Channel | Domain to add |
|---|---|
| Chrome Web Store | `chrome-extension://<CHROME_STORE_ID>` |
| Edge Add-ons Store | `chrome-extension://<EDGE_STORE_ID>` |
| Safari | `safari-web-extension://com.yourcompany.icecap` |
| Sideload | `chrome-extension://<SIDELOAD_STABLE_ID>` |

### When to Add Each Domain

- **Chrome / Edge:** After first uploading to the respective store (the ID is visible on the extension's listing page before submission completes).
- **Safari:** Before Xcode submission — bundle ID is set during converter step.
- **Sideload:** After generating the manifest key and computing the derived ID (the build-all script prints it).

---

## Content Security Policy (Production)

The current CSP in `apps/extension/package.json` allows emulator URLs. For production builds, update `content_security_policy.extension_pages` to allow Firebase production endpoints:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com"
}
```

> The emulator URLs (`http://127.0.0.1:*`) are automatically excluded in production because `PLASMO_PUBLIC_USE_EMULATOR` is not set to `"true"` in production `.env` files.

---

## Safari Compatibility Notes

> ⚠️ Safari support requires work beyond the build pipeline.

The current extension uses `chrome.sidePanel`, the `sidePanel` manifest permission, and `chrome.sidePanel.setPanelBehavior()` — all of which are Chrome-specific APIs with no Safari equivalent.

Before submitting to the Mac App Store, the following must be addressed:

1. **Side Panel:** Replace or gate `chrome.sidePanel` usage with a Safari-compatible UI (e.g. toolbar popup).
2. **Auth Flow:** `signInWithPopup` behavior differs in Safari's sandboxed extension context — test thoroughly.
3. **API Gating:** Use `typeof chrome.sidePanel !== 'undefined'` checks to prevent runtime errors on Safari.

---

## Environment Variables

Firebase configuration is shared across all channels (same Firebase project). No channel-specific `.env` files are needed unless you want per-channel feature flags or separate Firebase projects.

The single `.env` (copied from `.env.example`) is used for all production channel builds. Set `PLASMO_PUBLIC_USE_EMULATOR=false` (or omit it) for all production builds.

---

## Release Checklist

- [ ] Run `./scripts/build-extension-all.sh` from repo root
- [ ] **Chrome:** Upload `dist/extension/icecap-chrome.zip` to Chrome Web Store Developer Console
- [ ] **Chrome:** Add `chrome-extension://<ID>` to Firebase Authorized Domains
- [ ] **Edge:** Upload `dist/extension/icecap-edge.zip` to Edge Partner Center
- [ ] **Edge:** Add `chrome-extension://<ID>` to Firebase Authorized Domains
- [ ] **Safari:** Run `xcrun safari-web-extension-converter` on unzipped `icecap-safari-raw.zip`
- [ ] **Safari:** Archive and submit via Xcode / App Store Connect
- [ ] **Safari:** Add `safari-web-extension://com.yourcompany.icecap` to Firebase Authorized Domains
- [ ] **Sideload:** Generate manifest key and add to `apps/extension/package.json` before building
- [ ] **Sideload:** Add `chrome-extension://<STABLE_ID>` to Firebase Authorized Domains
- [ ] **All channels:** Update production CSP to remove emulator `connect-src` entries
