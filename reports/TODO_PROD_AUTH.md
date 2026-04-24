# TODO: Production Firebase Authentication Configuration for Chrome Extension

To ensure Firebase Authentication works correctly when the Icecap extension is deployed to production, the following steps must be completed.

## 1. Stabilize Extension ID
A consistent Extension ID is required for the Firebase Authorized Domains list.
- [ ] Generate a production RSA key for the extension.
- [ ] Add the `"key"` field to the `manifest.json` (via `package.json` in Plasmo).
- [ ] Document the production Extension ID for reference.

## 2. Firebase Console Configuration
- [ ] Log in to the [Firebase Console](https://console.firebase.google.com/).
- [ ] Navigate to **Authentication** > **Settings** > **Authorized domains**.
- [ ] Add the production extension origin: `chrome-extension://<STABLE_EXTENSION_ID>`.

## 3. Production Content Security Policy (CSP)
- [ ] Update the `content_security_policy` in `apps/extension/package.json` for the production build.
- [ ] Ensure it includes `connect-src` for `https://*.firebaseio.com` and `https://*.googleapis.com`.

## 4. Explore Proxy Auth Flow (Optional/UX Improvement)
- [ ] Evaluate implementing a "Login via Hub" flow where the user authenticates on the website and the token is passed back to the extension. This is often more robust than `signInWithPopup` in extension contexts.

---
*Note: The current implementation uses a fallback popup (`options.html?view=login`), which should be tested in a production-like build (chrome-mv3-prod) before full deployment.*
