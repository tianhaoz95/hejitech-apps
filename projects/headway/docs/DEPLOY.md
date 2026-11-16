# Deployment

Headway runs on the shared HEJI Supabase project (`jitdzllkxfhlrxxvljhp`, schema `headway`), one
Cloudflare Worker (`https://headway.hejitech.workers.dev`), App Store Connect (`com.hejitech.headway`)
and the Even Hub. Steps in order; each says who does it.

## 1. Database (once)

```sh
supabase db push --dry-run     # from the repo root: should list only *_headway_init.sql
supabase db push
```

Then in the Supabase dashboard → API settings, add `headway` to the exposed schemas (read the list
first and extend it; every HEJI project is in it).

## 2. Auth (once)

Read the current lists first, then extend them (the Site URL belongs to Waypack):

- Redirect URLs: add `headway://login-callback` (iPhone Google sign-in) and
  `https://headway.hejitech.workers.dev/**` (web sign-in and consent).
- Apple provider → client IDs: add `com.hejitech.headway` (Sign in with Apple in the app).

## 3. Worker

Cloudflare Workers Builds (dashboard, the owner): new project from this repo, root directory = repo
root, build `npm ci`, deploy `npm run deploy -w @headway/web`, non-production
`npm run upload-version -w @headway/web`, watch path `projects/headway/*`. The first deploy
provisions the `OAUTH_KV` namespace and the every-minute cron trigger.

Secrets (`cd projects/headway/services/web`):

```sh
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production   # the shared project's secret key
npx wrangler secret put TRANSIT_511_API_KEY --env production         # free token: https://511.org/open-data/token
npx wrangler secret put APNS_KEY_ID --env production                 # an APNs auth key (developer portal → Keys)
npx wrangler secret put APNS_PRIVATE_KEY --env production            # that key's .p8 contents
npx wrangler secret put FCM_PRIVATE_KEY --env production             # Android alerts: the "private_key" of the Firebase service account (~/Credentials/heji-apps-firebase-adminsdk.json)
npx wrangler secret put APPLE_SIWA_KEY_ID --env production           # a Sign in with Apple key (developer portal → Keys, primary App ID com.hejitech.headway)
npx wrangler secret put APPLE_SIWA_PRIVATE_KEY --env production      # that key's .p8 contents: account deletion revokes the Apple token (src/worker/apple.ts)
```

Without the 511 token boards are timetable-only (`/api/status` says `realtime.configured: false`);
without the APNs key nothing is pushed (`push.configured: false`) and the app's Settings says alerts
aren't switched on. One APNs key serves every app of team 68CTFST8W2 (the topic is the bundle id).

Android alerts go through Firebase Cloud Messaging and nothing else of Firebase: the Worker signs a
JWT with the service account's key, trades it for a Google access token and calls FCM's HTTP v1 API
(`push.ts`). The Firebase project is `heji-apps` ("HEJI Apps", console signed in as the team's dev
Google account), shared by the HEJI apps for now: `FCM_PROJECT_ID` and `FCM_CLIENT_EMAIL` are vars in
`wrangler.jsonc`, the key a secret. The service account file is `~/Credentials/heji-apps-firebase-adminsdk.json`,
also the team-wide GitHub secret `FIREBASE_SERVICE_ACCOUNT_JSON` (no workflow reads it yet). The app has no `google-services.json`: its four values are in
`apps/android/app/src/main/res/values/firebase.xml`. Moving Headway to a Firebase project of its
own later means a new `firebase.xml`, new vars and key, and every phone registering again after it
updates (a token belongs to one Firebase project), so send through both projects for a while.
Without the key Android phones register but get nothing (`POST /api/push` answers `configured: false`).

Smoke test:

```sh
curl -s https://headway.hejitech.workers.dev/api/status | jq
curl -s "https://headway.hejitech.workers.dev/api/board?from=mountain_view&to=san_francisco" | jq '.live, .trains[0]'
curl -s -o /dev/null -w "%{http_code}\n" https://headway.hejitech.workers.dev/mcp            # 401 + OAuth hint
curl -s https://headway.hejitech.workers.dev/.well-known/oauth-authorization-server | jq .issuer
```


### Pro on the web (Stripe) and App Store notifications

Set up 2026-11-16 (decisions: "Pro on every platform"). Stripe is the shared HEJI account; the
product, the yearly and lifetime prices and the webhook (`https://headway.hejitech.workers.dev/stripe/webhook`,
five events) come from `node scripts/stripe_pro.mjs headway --live` (idempotent; ids and the webhook
secret in `~/Credentials/stripe.env`, `HEADWAY_STRIPE_*`). The price ids are `env.production.vars` in
`wrangler.jsonc`; the keys are secrets:

```sh
npx wrangler secret put STRIPE_SECRET_KEY --env production       # HEJI_TECHNOLOGY_LIVE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production   # HEADWAY_STRIPE_WEBHOOK_SECRET
```

App Store Server Notifications V2 (production and sandbox) go to `/appstore/notifications`:
`node .claude/skills/heji-app-store-iap/iap.mjs notifications com.hejitech.headway https://headway.hejitech.workers.dev/appstore/notifications`.
Locally, put the sandbox key and `node scripts/stripe_pro.mjs headway`'s price ids in `.dev.vars`.

## 4. iPhone app

1. App Store Connect (the owner): a new app record for `com.hejitech.headway` (name "Headway",
   primary language English, category Travel / Navigation). Signing registers the App ID's
   capabilities (Push Notifications, Sign in with Apple, Time Sensitive Notifications) on the first
   archive through `-allowProvisioningUpdates`.
2. `scripts/cut_release.sh headway --dry-run`, then `scripts/cut_release.sh headway` from a clean,
   pushed, CI-green `main`. The first release ships `0.1.0` (what `project.yml` says).
3. The release runs `headway-testflight.yml` (team-wide signing secrets) and waits for App Store
   Connect's processing verdict.

Privacy answers for the listing (published 2026-11-12): name (family display name), email address,
user id and other user content (commute, tracked train, family shares and status), all app
functionality, linked to the user, not used for tracking; no location (used for one answer, never
kept), no analytics. Content rights: uses third-party content (Caltrain, 511.org). Privacy policy:
`https://headway.hejitech.workers.dev/privacy/`; support: `https://headway.hejitech.workers.dev/support/`.

Price (owner's call; paid upfront 2026-11-13, then on 2026-11-14 changed to a free download with
in-app purchases): **Headway Pro**, needed for the whole iPhone app after a 1-week free trial, as the
yearly subscription `com.hejitech.headway.pro.annual` ($4.99/yr, the trial is its introductory
offer) or the lifetime unlock `com.hejitech.headway.pro.lifetime` ($9.99 once). The App Store price of
the app itself is Free. StoreKit 2 checks the purchase on the phone (`ProStore.swift`, `ProViews.swift`:
the gate, the purchase screen, Settings › Headway Pro); no server is involved, so the web app, glasses
and Android aren't gated. Debug builds skip the gate with `-proUnlocked`. Pro for free by email (testers, early adopters, the
owner): `scripts/grant_pro.sh headway <email> [--until YYYY-MM-DD] [--revoke] | --list`; the person taps "Have a
Pro invite? Sign in" on the purchase screen. Products, review
screenshots and notes: skill `heji-app-store-iap` (`iap.mjs status com.hejitech.headway`).
Google Play keeps its one-time $6.99 until Play Billing is added (Play can go paid → free but never back). Store text: `apps/ios/AppStore/description.txt`;
captioned slides: `node scripts/store_captions.mjs projects/headway/apps/ios/AppStore/captions.json`.

## 5. Even Hub plugin

The release attaches `headway-glasses-<version>.ehpk` (`headway-glasses-release.yml`). Everything the
portal asks, ready to paste and upload (text, category, tags, data rows, icon, background,
screenshots, reviewer note): `docs/even-hub/LISTING.md`; the portal's rules and quirks:
`.claude/skills/heji-even-hub-submit/SKILL.md`. Before submitting, install the Beta build on real
glasses and check the layout, every ring gesture, the exit dialog (the simulator doesn't draw it)
and five minutes with the phone locked (package `com.hejitech.headway.glasses`).

## 6. Docs

`https://tianhaoz95.github.io/hejitech-apps/headway/` builds from `docs/` on push (`pages.yml`).
