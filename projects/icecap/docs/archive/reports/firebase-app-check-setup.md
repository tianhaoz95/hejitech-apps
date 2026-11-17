# Firebase App Check — Step-by-Step Configuration Guide

**Project:** `icecap-platform`  
**Firebase SDK:** v12  
**Apps covered:** Hub · Admin · Waitlist · Promo · Chrome Extension (Plasmo MV3)

---

## Overview

Firebase App Check protects your Firestore database and Cloud Functions from abuse by verifying that requests come from your legitimate apps. Without it, anyone who finds your API key can query or write to Firestore directly.

Each app type uses a different attestation provider:

| App | Provider |
|---|---|
| Hub, Admin, Waitlist, Promo | reCAPTCHA Enterprise (recommended) or reCAPTCHA v3 |
| Chrome Extension (MV3) | Debug provider in dev · Custom backend provider in prod |

---

## Part 1 — Firebase Console Setup

### 1.1 Register each app with App Check

1. Open [Firebase Console](https://console.firebase.google.com) → select **icecap-platform**.
2. Go to **Build → App Check** in the left sidebar.
3. Click **Get started** if this is your first time, otherwise click **Register app**.
4. You will see all Firebase apps registered under the project. Register each one:

   | App name in Console | App ID (from `firebase.ts`) |
   |---|---|
   | `icecap-hub` | `1:117464393734:web:a6d327244b151879163b87` |
   | `icecap-admin` | `1:117464393734:web:f3526e79da07d84c163b87` |
   | `icecap-waitlist` | *(same config — register separately if you created a dedicated app)* |
   | `icecap-extension` | `1:117464393734:web:a6d327244b151879163b87` |

   > **Note:** If the waitlist, promo, and extension share the same Firebase App ID as the hub, they share one App Check registration. For stronger isolation, create separate Firebase apps in the Console and update the `appId` in each app's `firebase.ts`.

### 1.2 Create a reCAPTCHA Enterprise site key (web apps)

1. Open [Google Cloud Console](https://console.cloud.google.com) → select project **icecap-platform**.
2. Go to **Security → reCAPTCHA Enterprise**.
3. Click **Create key**.
4. Fill in:
   - **Display name:** `icecap-web`
   - **Application type:** Web
   - **Domains:** Add all your production domains:
     ```
     icecap-hub.web.app
     icecap-hub.firebaseapp.com
     icecap-admin.web.app
     icecap-admin.firebaseapp.com
     icecap-preview-list.web.app
     icecap-promo.web.app
     localhost
     ```
5. Click **Create** and copy the **Site Key** (format: `6Lc…`). You will need it in every web app.

### 1.3 Link the reCAPTCHA key to App Check

1. Back in **Firebase Console → App Check**, click the app you registered (e.g., `icecap-hub`).
2. Select **reCAPTCHA Enterprise** as the provider.
3. Paste the Site Key from step 1.2.
4. Click **Save**.
5. Repeat for each web app registration.

### 1.4 Generate a debug token (for local development)

1. In **Firebase Console → App Check**, click the registered app.
2. Click **⋮ (menu) → Manage debug tokens**.
3. Click **Add debug token**, give it a name (e.g., `local-dev`), and copy the generated UUID.
4. Store it — you will set it as an environment variable in step 3.4.

---

## Part 2 — Web Apps (Hub, Admin, Waitlist, Promo)

All four Vite/React apps follow the same pattern.

### 2.1 Install the App Check SDK

The Firebase v12 SDK already includes App Check. No extra package needed — just import from `firebase/app-check`.

### 2.2 Update `apps/hub/src/core/firebase.ts`

Add App Check initialization **before** any other Firebase service is used:

```ts
import { initializeApp, getApps } from "firebase/app"
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  CustomProvider,
} from "firebase/app-check"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
// … other imports

const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true"

const firebaseConfig = {
  apiKey: "AIzaSyD1D2A0h-IUcIyJynq7lh_scNZL6IrXVpc",
  authDomain: "icecap-platform.firebaseapp.com",
  projectId: useEmulator ? "demo-icecap" : "icecap-platform",
  storageBucket: "icecap-platform.firebasestorage.app",
  messagingSenderId: "117464393734",
  appId: "1:117464393734:web:a6d327244b151879163b87",
  measurementId: "G-V1M7Z1FDT3",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// ── App Check ──────────────────────────────────────────────────────────────
if (!useEmulator) {
  if (import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
    // Inject the debug token so the browser-side debug provider picks it up.
    // Must be set BEFORE initializeAppCheck is called.
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY
    ),
    isTokenAutoRefreshEnabled: true,
  })
}
// ──────────────────────────────────────────────────────────────────────────

const db = getFirestore(app)
// … rest of the file unchanged
```

Repeat the same change in:
- `apps/admin/src/core/firebase.ts` (use the admin app's `appId`)
- `apps/waitlist/src/core/firebase.ts`
- `apps/promo/src/core/firebase.ts`

### 2.3 Add environment variables

Add to `.env` (local) and GitHub Secrets (CI/CD):

```bash
# .env (local dev — do NOT commit)
VITE_RECAPTCHA_SITE_KEY=6Lc...your-site-key...
VITE_APPCHECK_DEBUG_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # from step 1.4
```

Add the same keys as GitHub repository secrets:
- `VITE_RECAPTCHA_SITE_KEY` — the reCAPTCHA Enterprise site key
- `VITE_APPCHECK_DEBUG_TOKEN` — **only** for staging/preview builds, never for production

### 2.4 Update CI build steps to inject the site key

In `.github/workflows/deploy-on-release.yml`, add the environment variable to the build step:

```yaml
- name: Verify Build Artifacts
  env:
    VITE_RECAPTCHA_SITE_KEY: ${{ secrets.VITE_RECAPTCHA_SITE_KEY }}
    # ... existing env vars
  run: |
    # Add to hub env
    echo "VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY" >> apps/hub/.env
    # Add to admin env (if it has its own .env setup)
    echo "VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY" >> apps/admin/.env
    # Add to waitlist env
    echo "VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY" >> apps/waitlist/.env
    # Add to promo env  
    echo "VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY" >> apps/promo/.env
    
    pnpm turbo run build
    # ... rest unchanged
```

Also update `deploy-waitlist.yml` to inject the site key during the waitlist-specific build:

```yaml
- name: Build waitlist
  env:
    VITE_RECAPTCHA_SITE_KEY: ${{ secrets.VITE_RECAPTCHA_SITE_KEY }}
  run: |
    echo "VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY" > apps/waitlist/.env
    pnpm --filter @icecap/waitlist run build
```

---

## Part 3 — Chrome Extension (Plasmo MV3)

Chrome extensions **cannot** use reCAPTCHA because the reCAPTCHA script injection violates MV3's Content Security Policy. Instead:

- **Development:** Use the Firebase debug token provider.
- **Production:** Use a Custom Provider that calls a Cloud Function to mint App Check tokens server-side.

### 3.1 Development — debug token in the extension

In `apps/extension/src/core/firebase.ts`, add:

```ts
import {
  initializeAppCheck,
  CustomProvider,
} from "firebase/app-check"

// After app initialization, before any service use:
if (!useEmulator) {
  if (process.env.PLASMO_PUBLIC_APPCHECK_DEBUG_TOKEN) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.PLASMO_PUBLIC_APPCHECK_DEBUG_TOKEN
  }

  // In production this CustomProvider implementation is replaced in step 3.2.
  // During development the debug token above causes Firebase to use the debug provider automatically.
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => ({
        token: "debug-placeholder",
        expireTimeMillis: Date.now() + 3600 * 1000,
      }),
    }),
    isTokenAutoRefreshEnabled: true,
  })
}
```

Add to `apps/extension/.env`:
```bash
PLASMO_PUBLIC_APPCHECK_DEBUG_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> When `FIREBASE_APPCHECK_DEBUG_TOKEN` is set to a valid debug token registered in the Console (step 1.4), Firebase's SDK automatically uses the debug provider and ignores the `CustomProvider` implementation — so the placeholder `getToken` above is never called during local development.

### 3.2 Production — Custom Provider via Cloud Function

For production builds the extension must obtain a real App Check token from a backend you control.

**Step A: Create a Cloud Function to mint tokens**

In `firebase/functions/src/index.ts`, add:

```ts
import * as admin from "firebase-admin"

export const mintAppCheckToken = functions.https.onCall(
  { enforceAppCheck: false }, // This function itself is the trust boundary
  async (request) => {
    // Verify the caller is a signed-in user (optional but recommended)
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in required.")
    }

    const appId = "1:117464393734:web:a6d327244b151879163b87" // extension App ID
    const ttlMillis = 3600 * 1000 // 1 hour

    const appCheckToken = await admin.appCheck().createToken(appId, {
      ttlMillis,
    })

    return { token: appCheckToken.token, expireTimeMillis: Date.now() + ttlMillis }
  }
)
```

**Step B: Call the function from the extension's Custom Provider**

```ts
import { httpsCallable } from "firebase/functions"

const mintToken = httpsCallable<void, { token: string; expireTimeMillis: number }>(
  functions,
  "mintAppCheckToken"
)

initializeAppCheck(app, {
  provider: new CustomProvider({
    getToken: async () => {
      const result = await mintToken()
      return result.data
    },
  }),
  isTokenAutoRefreshEnabled: true,
})
```

### 3.3 Update the extension CSP

The App Check SDK makes outbound requests to `https://firebaseappcheck.googleapis.com`. Add it to the `connect-src` directive in `apps/extension/package.json`:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* wss://localhost:* https://*.googleapis.com wss://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://firebaseappcheck.googleapis.com"
}
```

> `https://*.googleapis.com` already covers `firebaseappcheck.googleapis.com`, so this is only needed if you later tighten the wildcard.

---

## Part 4 — Local Development with the Emulator

The Firebase Emulator Suite does **not** validate App Check tokens. The `if (!useEmulator)` guard added in Part 2 and Part 3 prevents `initializeAppCheck` from being called entirely when `VITE_USE_EMULATOR=true`, so development against the emulator requires no further changes.

To confirm: your existing emulator startup in `package.json` (`pnpm run emulator`) already sets `singleProjectMode: true` in `firebase.json`, which makes the emulator permissive for all local requests.

---

## Part 5 — Enforce App Check on Firestore and Cloud Functions

Until enforcement is turned on, App Check tokens are minted but **not required** — it is monitoring-only.

### 5.1 Enforce on Firestore

1. In **Firebase Console → App Check**, click the **Firestore** tile under "Firebase services".
2. Click **Enforce**.
3. Confirm the dialog. Requests without a valid App Check token will now receive a `403 PERMISSION_DENIED` error.

> Enable enforcement **after** you have verified App Check is working in production (check the Console metrics panel — you should see near-100% valid token rate before enforcing).

### 5.2 Enforce on Cloud Functions (per-function)

Add `enforceAppCheck: true` to each callable function that should be protected:

```ts
// Before
export const analyzeProperty = functions.https.onCall(async (request) => { … })

// After
export const analyzeProperty = functions.https.onCall(
  { enforceAppCheck: true },
  async (request) => { … }
)
```

Functions that should remain publicly callable (e.g., webhook receivers for Stripe) must **not** have `enforceAppCheck: true`.

---

## Part 6 — Verify It's Working

### 6.1 Check the App Check metrics dashboard

1. **Firebase Console → App Check → your app**.
2. The **Metrics** tab shows a timeline of:
   - **Valid requests** — passed App Check
   - **Invalid requests** — no token or expired token
   - **Unknown requests** — requests from before App Check was initialized

Wait 24 hours after deploying before enforcing to ensure the valid-request rate is stable above 98%.

### 6.2 Test locally with a debug token

1. Set `VITE_APPCHECK_DEBUG_TOKEN` (or `PLASMO_PUBLIC_APPCHECK_DEBUG_TOKEN` for the extension) to the UUID from step 1.4.
2. Open DevTools → Network and confirm requests to Firestore carry an `X-Firebase-AppCheck` header.
3. Temporarily remove the debug token and confirm Firestore requests fail with 403 after enforcement is enabled.

### 6.3 Confirm the emulator is unaffected

Run `pnpm run dev:all` and perform a full workflow (scrape → save deal → sync to hub). Nothing should change — the emulator ignores App Check entirely.

---

## Summary Checklist

- [ ] reCAPTCHA Enterprise site key created in Google Cloud Console
- [ ] Site key linked to each web app in Firebase Console → App Check
- [ ] `initializeAppCheck` added to `firebase.ts` in Hub, Admin, Waitlist, Promo
- [ ] `VITE_RECAPTCHA_SITE_KEY` added to `.env` files and GitHub Secrets
- [ ] CI build steps updated to inject `VITE_RECAPTCHA_SITE_KEY`
- [ ] Debug token generated and stored for local development
- [ ] Extension CSP updated (if you tighten the wildcard later)
- [ ] Extension debug token set via `PLASMO_PUBLIC_APPCHECK_DEBUG_TOKEN`
- [ ] `mintAppCheckToken` Cloud Function deployed for extension production use
- [ ] App Check metrics monitored for 24–48 hours post-deploy
- [ ] Enforcement enabled on Firestore once valid-request rate is stable
- [ ] `enforceAppCheck: true` added to protected Cloud Functions
