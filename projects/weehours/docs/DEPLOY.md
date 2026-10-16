# Deploying Wee Hours

Wee Hours shares the HEJI monorepo's Supabase project, GitHub repo and Apple team with the other
apps. Conventions for the shared parts: `../../../supabase/README.md`.

| Piece | Where | Ships on |
|---|---|---|
| Database | Supabase `jitdzllkxfhlrxxvljhp`, schema `weehours`, bucket `weehours` | `supabase db push` (by hand, repo root) |
| Site + MCP + OAuth | Cloudflare Worker `weehours` → https://weehours.hejitech.workers.dev | push to `main` (Workers Builds), or `npm run deploy -w @weehours/web` |
| iPhone app (+ widgets, watch) | App Store Connect `com.hejitech.weehours`, TestFlight | GitHub Release `weehours-v<version>` (`scripts/cut_release.sh weehours`), weekly Wednesday run, manual dispatch |
| Glasses app | Even Hub (`apps/glasses`, `npm run package`) | by hand |

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
  (the site signs in with Google/Apple and returns to the page it started on). Leave Site URL
  alone: it belongs to Waypack.
- Email sign-in stays **off** (project-wide; the app shows email only in Debug builds).
- **Google in the app** is still a placeholder button: native Google sign-in needs an iOS OAuth
  client added to the Google provider's client IDs, and the GoogleSignIn flow in the app.

## 2. Cloudflare

The `weehours` Worker (`services/web/wrangler.jsonc`, `env.production`):

- Secret: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production` (the shared project's
  secret key; it bypasses RLS for every project, so it stays in Worker secrets).
- KV `OAUTH_KV` holds OAuth clients and grants (provisioned by the first deploy).
- **Workers Builds** (dashboard → Workers → `weehours` → Settings → Build): connect
  `tianhaoz95/hejitech-apps`, branch `main`, root directory = repo root, build command `npm ci`,
  deploy command `npm run deploy -w @weehours/web`, build watch paths `projects/weehours/*`.

## 3. TestFlight

`.github/workflows/weehours-testflight.yml` runs `scripts/release_testflight.sh` on macOS with the
repo secrets Waypack uses: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`, `SIGNING_P12_BASE64` /
`SIGNING_P12_PASSWORD` (Apple Distribution: HEJI TECHNOLOGY LLC), `DEV_SIGNING_P12_BASE64` /
`DEV_SIGNING_P12_PASSWORD` (Apple Development: Tianhao Zhou, SHA-1 `2CF449D6…`, which the script
pins). Optional: `FEEDBACKKIT_RELEASE_TOKEN`, created with
`npx feedbackkit-cli token create github-actions --preset ci | gh secret set FEEDBACKKIT_RELEASE_TOKEN`
after `npx feedbackkit-cli login`. The workflow imports the existing identities, so CI never
creates certificates.
