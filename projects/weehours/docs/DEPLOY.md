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

## 4. Even Hub (glasses)

The glasses app ships with the iPhone app, under the same version: `scripts/cut_release.sh weehours`
bumps `MARKETING_VERSION` in `apps/ios/project.yml`, `apps/glasses/scripts/pack.mjs` stamps it into
the plugin's `app.json`, and `weehours-glasses-release.yml` attaches
`weehours-glasses-<version>.ehpk` to the GitHub Release. Locally: `npm run package -w
@weehours/glasses` → `apps/glasses/build/weehours.ehpk`.

1. Wait for the release's Worker deploy (the glasses' API is `https://weehours.hejitech.workers.dev/api/glasses/*`; the plugin's only network whitelist entry).
2. Download the `.ehpk` from the release and upload it in the Even Hub developer portal (package `com.hejitech.weehours.glasses`). The pack refuses a manifest that whitelists local addresses.
3. Check on real glasses: install from the Even Hub, pair with a code from Settings → Even G2 glasses on a Release build, press (feed), double press (diaper), hold to speak, and see the entries and the capture on the phone. The simulator isn't faithful for BLE lag, font metrics or the microphone.

Pairing codes and the wrong-code throttle live in the Worker's `OAUTH_KV` namespace (`glasses-code:*`,
`glasses-pairfail:*`); paired glasses are rows in `weehours.access_tokens` named `glasses:<label>`.

