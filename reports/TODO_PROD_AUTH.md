# Production Auth Setup: Chrome Extension Google Sign-In

The extension uses `firebase/auth/web-extension` + `chrome.identity.launchWebAuthFlow` for
Google Sign-In in MV3. This replaces the standard `signInWithPopup` (which doesn't work in
Chrome MV3 extension contexts). The code is complete — the steps below are one-time console
configuration required to make it work.

## Extension Identity

The extension has a fixed ID derived from the `key` field in `apps/extension/package.json`:

```
cljkjphaofjfagcekpbnkonpepdcciba
```

This ID is deterministic for any sideloaded or published build using that same key. If the
extension is published to the Chrome Web Store and a different key is used, the Web Store will
assign a different ID — update the entries below accordingly.

---

## Required One-Time Setup

### 1. Google Cloud Console — Register the OAuth Redirect URI

The `chrome.identity.launchWebAuthFlow` call redirects to a `chromiumapp.org` URL that Chrome
intercepts locally. Google's OAuth server must allow this redirect URI before it will proceed.

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click the OAuth 2.0 Client ID:
   `117464393734-p5bahcbmebco1lol4uttii5bl691b2jg.apps.googleusercontent.com`
3. Under **Authorized redirect URIs**, add exactly (trailing slash required):
   ```
   https://cljkjphaofjfagcekpbnkonpepdcciba.chromiumapp.org/
   ```
4. Click **Save**

> If you see **Error 400: redirect_uri_mismatch** in the sign-in popup, this step hasn't been
> done yet.

### 2. Firebase Console — Add Authorized Domain

Firebase validates the redirect domain server-side before issuing auth tokens.

1. Go to [Firebase Console → Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/icecap-platform/authentication/settings)
2. Click **Add domain** and enter (no protocol, no trailing slash):
   ```
   cljkjphaofjfagcekpbnkonpepdcciba.chromiumapp.org
   ```
3. Click **Add**

### 3. Extension `.env` — Set the OAuth Client ID

Add to `apps/extension/.env` (already gitignored):

```
PLASMO_PUBLIC_GOOGLE_CLIENT_ID=117464393734-p5bahcbmebco1lol4uttii5bl691b2jg.apps.googleusercontent.com
```

This is also stored as a GitHub Actions secret (`PLASMO_PUBLIC_GOOGLE_CLIENT_ID`) for CI/CD builds.

---

## Why the Extension Needs This (Hub Does Not)

The Hub uses Firebase's standard `signInWithPopup`, which works in normal browser tabs via a
`window.open` popup and `window.opener.postMessage` relay. Chrome MV3 blocks `window.open`-based
OAuth popups from extension contexts (sidepanels, options pages, service workers).

`chrome.identity.launchWebAuthFlow` is Chrome's native OAuth API for extensions. It opens a
Chrome-managed auth window and intercepts the redirect — but requires the OAuth URL to be
constructed manually, which is why the `client_id` must be supplied explicitly.

---

## Edge Browser

Edge is Chromium-based and uses the same `chrome.identity` API and `chromiumapp.org` redirect
domain. Edge extensions have different extension IDs, so a separate redirect URI and Firebase
authorized domain entry would be needed for an Edge build.

## Firefox (Not Yet Supported)

Firefox uses `browser.identity.launchWebAuthFlow` and a different redirect domain
(`*.extensions.allizom.org`). See `TODO_FIREFOX_SUPPORT.md`.
