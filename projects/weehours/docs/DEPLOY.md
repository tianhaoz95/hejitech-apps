# Deploying Wee Hours

Wee Hours shares the HEJI monorepo's Supabase project, GitHub repo and Apple team with the other
apps. Conventions for the shared parts: `../../../supabase/README.md`.

| Piece | Where | Ships on |
|---|---|---|
| Database | Supabase `jitdzllkxfhlrxxvljhp`, schema `weehours`, bucket `weehours` | `supabase db push` (by hand, repo root) |
| Site + MCP + OAuth | Cloudflare Worker `weehours` → https://weehours.hejitech.workers.dev | push to `main` (Workers Builds), or `npm run deploy -w @weehours/web` |
| iPhone app (+ widgets, watch) | App Store Connect `com.hejitech.weehours`, TestFlight | GitHub Release `weehours-v<version>` (`scripts/cut_release.sh weehours`), weekly Wednesday run, manual dispatch |
| Glasses app (Even G2 + R1) | Even Hub plugin `com.hejitech.weehours.glasses`; its API is the site Worker (`/api/glasses/*`) | `.ehpk` attached to each `weehours-v<version>` release (`weehours-glasses-release.yml`); upload to the Even Hub portal by hand (§4) |

## 1. Supabase (shared project)

```sh
supabase db push            # repo root; applies supabase/migrations (all projects)
```

Then, in this order (an exposed schema that doesn't exist yet breaks the Data API):

- **API → Exposed schemas:** add `weehours` (Management API: `PATCH /v1/projects/<ref>/postgrest`,
  `db_schema = "public,graphql_public,weehours"`).
- **Auth → Apple → Client IDs:** comma-separated list including `com.hejitech.weehours` (the app's
  native Sign in with Apple sheet).
- **Auth → URL configuration → Redirect URLs:** add `https://weehours.hejitech.workers.dev/**`
  (the site signs in with Google/Apple and returns to the page it started on) and
  `weehours://login-callback` (the app's Google sign-in). Leave Site URL alone: it belongs to
  Waypack.
- Email sign-in stays **off** (project-wide; the app shows email only in Debug builds).
- **Google** uses the project's existing Google provider (the shared HEJI web OAuth client) on the
  site and in the app; the app runs it in the system browser sheet with PKCE (like Waypack's app),
  so it needs no iOS OAuth client.

## 2. Cloudflare

The `weehours` Worker (`services/web/wrangler.jsonc`, `env.production`):

- Secret: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production` (the shared project's
  secret key; it bypasses RLS for every project, so it stays in Worker secrets).
- Secrets for Sign in with Apple token revocation on account deletion (App Store guideline 5.1.1(v);
  `src/worker/account.ts`): the team's HEJI key (`HEJI_APNS_KEY_ID` / `HEJI_APNS_KEY_P8_LOCATION` in
  `~/Credentials/hejitech-apps.env`) has both APNs and Sign in with Apple, so no separate key is needed:
  `wrangler secret put APPLE_SIWA_KEY_ID --env production` (the key id) and
  `wrangler secret put APPLE_SIWA_PRIVATE_KEY --env production` (the .p8 contents). Set 2026-11-15.
- KV `OAUTH_KV` holds OAuth clients and grants (provisioned by the first deploy).
- **Workers Builds** (dashboard → Workers → `weehours` → Settings → Build): connect
  `tianhaoz95/hejitech-apps`, branch `main`, root directory = repo root, build command `npm ci`,
  deploy command `npm run deploy -w @weehours/web`, non-production branch deploy command
  `npm run upload-version -w @weehours/web` (a preview URL per branch; previews use the production
  Supabase project and OAuth KV, like Waypack's), build watch paths `projects/weehours/*`.

## 3. TestFlight

`.github/workflows/weehours-testflight.yml` runs `scripts/release_testflight.sh` on macOS with the
repo secrets Waypack uses: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`, `SIGNING_P12_BASE64` /
`SIGNING_P12_PASSWORD` (Apple Distribution: HEJI TECHNOLOGY LLC), `DEV_SIGNING_P12_BASE64` /
`DEV_SIGNING_P12_PASSWORD` (Apple Development: Tianhao Zhou, SHA-1 `2CF449D6…`, which the script
pins). Optional: `WEEHOURS_FEEDBACKKIT_RELEASE_TOKEN`, created with
`npx feedbackkit-cli token create github-actions --preset ci | gh secret set WEEHOURS_FEEDBACKKIT_RELEASE_TOKEN`
after `npx feedbackkit-cli login`. The workflow imports the existing identities, so CI never
creates certificates.

## 3b. Wee Hours Pro (in-app purchases)
App Store Connect (app 6823293298): group "Wee Hours Pro" (22581321) with `com.hejitech.weehours.pro.monthly`
(6835032644) and `.pro.yearly` (6835032528), non-consumable `com.hejitech.weehours.pro.lifetime` (6835033524);
Server Notifications V2 (production + sandbox) at `https://weehours.hejitech.workers.dev/appstore/notifications`.
The Worker needs nothing new (Apple's root is in the code). Prices, review screenshots and the first submission
with the app version: skill `heji-app-store-iap` (`iap.mjs status com.hejitech.weehours`).

## 3c. Google Play (Android + Wear OS)

Play app "Wee Hours: Hands-Free Baby Log" in the HEJI TECH LLC Play Console, package
`com.hejitech.weehours` (app ID 4973129376279509482), free, created 2026-11-22. The phone app and the
Wear OS app share the package (one listing, Wear OS form factor added); the watch's version code is
the phone's + 1. Both sign with the upload key in `~/Credentials/weehours/` (`android-upload.env`,
also GitHub secrets `WEEHOURS_ANDROID_KEYSTORE_BASE64` / `_PASSWORD` / `WEEHOURS_ANDROID_KEY_ALIAS`);
Play App Signing holds the real key. Testers: the "HEJI owner" list on `internal` and `wear:internal`.

`scripts/cut_release.sh weehours` runs `weehours-play-internal.yml`, which builds both bundles at
`MARKETING_VERSION` and uploads them with the shared `play-publisher` service account
(`PLAY_SERVICE_ACCOUNT_JSON`, granted "Release apps to testing tracks" for this app only). Check:
`node .claude/skills/heji-google-play/play.mjs check com.hejitech.weehours`. By hand:

```sh
cd apps/android && set -a && . ~/Credentials/weehours/android-upload.env && set +a
./gradlew :app:bundleRelease :wear:bundleRelease -PversionCode=$(( ($(date -u +%s) - 1577836800) / 60 ))
```

Still the owner's before anything goes past internal testing: store listing (text, icon, feature
graphic, phone/tablet/Wear OS screenshots), content rating questionnaire, target audience, Data
safety, the app access (sign-in) details for review, and Pro through Play Billing (the Android app
has no billing yet). Steps: skill `heji-google-play`.

## 4. Even Hub (glasses)

The glasses app ships with the iPhone app, under the same version: `scripts/cut_release.sh weehours`
bumps `MARKETING_VERSION` in `apps/ios/project.yml`, `apps/glasses/scripts/pack.mjs` stamps it into
the plugin's `app.json`, and `weehours-glasses-release.yml` attaches
`weehours-glasses-<version>.ehpk` to the GitHub Release. Locally: `npm run package -w
@weehours/glasses` → `apps/glasses/build/weehours.ehpk`.

1. Wait for the release's Worker deploy (the glasses' API is `https://weehours.hejitech.workers.dev/api/glasses/*`; the plugin's only network whitelist entry).
2. Download the `.ehpk` from the release and upload it in the Even Hub developer portal (package `com.hejitech.weehours.glasses`). The portal's fields, icon format, categories and review rules: the `heji-even-hub-submit` skill and `docs/even-hub/LISTING.md`. The pack refuses a manifest that whitelists local addresses.
3. Check on real glasses: install from the Even Hub, pair with a code from Settings → Even G2 glasses on a Release build, press (feed), swipe (menu / diaper), double press (exit to Even OS), hold to speak, and see the entries and the capture on the phone. The simulator isn't faithful for BLE lag, font metrics or the microphone.

Pairing codes and the wrong-code throttle live in the Worker's `OAUTH_KV` namespace (`glasses-code:*`,
`glasses-pairfail:*`); paired glasses are rows in `weehours.access_tokens` named `glasses:<label>`.

