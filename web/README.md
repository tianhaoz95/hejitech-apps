# Web

Per the MVP scope (see `reports/mvp-scope-v0.html` Section 4.4), the web app
is scoped to three things — never day-to-day capture:

- **Subscription/billing.** The only place a user can subscribe. Android and
  iOS deliberately carry no purchase flow, no pricing mention, and no
  external-purchase link, to stay out of Apple/Google's in-app-purchase
  platform fee entirely. The mobile apps only read entitlement status.
- **Analysis dashboard.** The bigger-screen counterpart to the in-app pacing
  view — hours by property/activity, contemporaneity trend, threshold
  progress.
- **CPA back-office.** Export, bulk review, account settings.

## Status

Initial scaffold only (Vite + React + TypeScript), wired to the real
`contempo-platform` Firebase project — same Firestore data and Auth as the
mobile apps:

- Firebase Auth (Google Sign-In) and Firestore client SDK initialized in
  `src/lib/firebase.ts`, with the same emulator-vs-real dual path as
  `android/` (`VITE_USE_FIREBASE_EMULATOR`, defaults to on in `vite dev`).
- A registered "Contempo Web" app in the Firebase project
  (`1:646737053318:web:5a0e0bc35f564945ac3307`). Real config lives in
  `.env.local` (gitignored); `.env.example` documents the shape and how to
  regenerate it via
  `npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID> --project contempo-platform`.
- `src/auth/AuthContext.tsx` — Google Sign-In popup + auth-state listener.
- `src/billing/subscription.ts` — **not implemented yet**, stubbed with a
  `TODO(stripe)`. Plan is Stripe's official Firebase Extension ("Run Payments
  with Stripe"), syncing subscription status into Firestore for every client
  to read.
- Analysis dashboard and CPA export/back-office UI: not built yet.

```bash
cd web
npm install
npm run dev     # local dev server
npm run build   # production build
```
