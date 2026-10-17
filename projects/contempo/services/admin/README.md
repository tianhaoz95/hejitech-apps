# Admin

Internal admin site — coupon management and feedback triage — restricted to
Google accounts explicitly granted admin access. Not linked from anywhere
public; not indexed (`<meta name="robots" content="noindex, nofollow">` in
`index.html`).

Same stack as `web/` (Vite + React + TypeScript), same `contempo-str`
Firebase project/Auth/Firestore, but its own Firebase Web App registration
("Contempo Admin") and its own Hosting site (`contempo-str-admin`,
`https://contempo.hejitech.workers.dev/admin/`) — entirely separate from `web/`'s
`contempo` site, same pattern `feedback/` already uses for its own site.

## Access control

- **Authentication**: the same Google account as the rest of the app (same
  Firebase project), but signed in via Google Identity Services
  (`src/pages/SignInPage.tsx`, `window.google.accounts.id`) rather than
  Firebase Auth's `signInWithPopup` — that helper opens accounts.google.com
  in a popup and falls back to relaying the result through a GAPI
  cross-window iframe (apis.google.com) when it decides direct postMessage
  isn't reliable, and that relay's own `window.close()` call was getting
  blocked by the popup's Cross-Origin-Opener-Policy in production (confirmed
  live — no header on our own domain fixes it, since we don't control
  apis.google.com's/accounts.google.com's headers). GIS issues a signed ID
  token directly with no popup-closing handshake; `AuthContext.tsx`'s
  `signInWithGoogleCredential` just exchanges that token for a Firebase
  session via `signInWithCredential`. Needs `VITE_ADMIN_GOOGLE_CLIENT_ID`
  (see `.env.example`) and that origin listed under the OAuth client's
  **Authorized JavaScript origins** in
  [Cloud Console](https://console.cloud.google.com/apis/credentials?project=contempo-str)
  — a Console-only setting with no Firebase CLI/API equivalent, so a new
  Hosting domain using this pattern needs that added by hand once.
- **Authorization**: a signed-in user additionally needs the `admin: true`
  custom claim on their Firebase Auth token. There's no UI to grant this —
  it's set out-of-band via the Admin SDK:

  ```bash
  cd backend/scripts
  npm install   # first run only
  node set-admin-claim.js --grant someone@example.com
  node set-admin-claim.js --revoke someone@example.com
  node set-admin-claim.js --list-admins
  ```

  After granting, that person needs to sign out and back in on admin/ (or
  wait for their token to naturally refresh) — `AuthContext.tsx` force-
  refreshes the token on every sign-in specifically so "sign out and back
  in" is enough, rather than needing to wait out Firebase's ~1hr natural
  refresh interval.
- **Enforcement**: the custom claim is checked in three independent places,
  so a signed-in non-admin can't reach admin data even by bypassing the UI —
  `backend/firestore.rules`' `isAdmin()`, `backend/storage.rules` (feedback
  screenshot reads), and `assertAdmin()` in
  `backend/functions-billing/src/index.ts` (every `admin*` Cloud Function).

## Features

- **Coupons** (`src/pages/CouponsPage.tsx`) — lists, creates, deactivates,
  and deletes Stripe Coupons + Promotion Codes via the `admin*` Cloud
  Functions (never calls the Stripe API directly from the browser — the
  secret key never leaves the server). A coupon is always created together
  with a promotion code (the string a host actually types at checkout);
  bare coupons with no code (e.g. created by hand in the Stripe Dashboard)
  show up in a secondary section.
- **Feedback** (`src/pages/FeedbackPage.tsx`) — two tabs:
  - *In-app reports*: `users/{uid}/appFeedback` across every user (a
    Firestore collection-group query, allowed for an admin by
    `isAdmin()`) — the "shake to report" screenshot + boxed region +
    description + device/app state reports, same data
    `.claude/skills/triage-feedback/` already processes. Each report has a
    **Generate prompt** button (`src/lib/prompts.ts`) that builds a
    ready-to-paste prompt for a local coding agent — same methodology as
    that skill (ground in real source, check both platforms, mark
    resolved when done) — plus **Mark triaged**/**Mark resolved** buttons
    that flip status directly (no need to run the skill's own script just
    for that).
  - *Anonymous submissions*: the top-level `feedback` collection (the
    login-free `feedback/` site's form) — simpler, no owner/status
    lifecycle, so "Hide" is a local-only (`localStorage`) dismissal rather
    than a server-side status change.

## Local dev

```bash
cd admin
npm install
npm run dev     # local dev server, defaults to the Firebase emulator suite
npm run build   # production build
```

`.env.local` (gitignored) holds the real Firebase Web App config — see
`.env.example` for the shape and how to regenerate it. Deliberately prefixed
`VITE_ADMIN_FIREBASE_*` rather than reusing `web/`'s `VITE_FIREBASE_*` names
— see `.env.example`'s comment for why (a same-name collision in the shared
CI build step).

Against the emulator suite, sign in with any emulator test account and grant
it the claim locally:

```bash
firebase emulators:start --project demo-contempo
# in another terminal, once signed in once via the UI so the user exists:
node backend/scripts/set-admin-claim.js --grant test@example.com
```

(`set-admin-claim.js` always targets Application Default Credentials against
whatever project it's pointed at — for the emulator, use the Emulator UI's
Auth tab to add the claim by hand instead, since ADC can't reach a local
emulator's Auth instance.)
