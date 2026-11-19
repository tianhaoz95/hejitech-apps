# Deployment

Folio runs on the shared HEJI Supabase project (`jitdzllkxfhlrxxvljhp`, publishable key
`sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8`, schema and bucket `folio`) and one Cloudflare
Worker (`https://folio.hejitech.workers.dev`, script `folio`).

## 1. Database (once)

```sh
supabase db push --dry-run     # from the repo root: should list only *_folio_init.sql
supabase db push
```

Then add `folio` to the exposed schemas (Dashboard → API settings, or the Management API
`PATCH /v1/projects/<ref>/postgrest` with `db_schema`; read the list first and extend it). The
migration creates the private `folio` Storage bucket.

## 2. Auth (once)

Read the redirect allow-list first, then add `https://folio.hejitech.workers.dev/**` (web sign-in,
OAuth consent and invitations). Apple and Google are already enabled project-wide; the web uses the
shared Services ID, so no Apple client id change is needed.

## 3. Worker

```sh
cd projects/folio/services/web
npm run deploy                                                     # first deploy provisions OAUTH_KV
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
npx wrangler secret put RENDER_SECRET --env production            # random 32+ bytes; signs private render links
```

`RENDER_SECRET` is also in `~/Credentials/folio/folio.env` and the GitHub secret
`FOLIO_RENDER_SECRET`. Rotating it only expires open render links (they're re-issued on load).

Cloudflare Workers Builds (linked 2026-11-19): the `folio` Worker builds from this repo, root
directory = repo root, build `npm ci`, deploy `npm run deploy -w @folio/web` on `main`, and
`npm run upload-version -w @folio/web` for other branches (preview versions). Pushes to `main` deploy;
check the "Workers Builds: folio" check on the commit.

Smoke test:

```sh
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://folio.hejitech.workers.dev/mcp     # 401 + OAuth hint
curl -s https://folio.hejitech.workers.dev/.well-known/oauth-authorization-server | jq .issuer
curl -s https://folio.hejitech.workers.dev/api/status | jq .version
```

Notifications and the App Review account (once; both safe to run again):

```sh
projects/folio/scripts/setup_push.sh       # APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (team key)
scripts/review_account.sh folio            # REVIEW_EMAIL, REVIEW_PASSWORD_SHA256 + App Store Connect
```

## 4. Releases

`scripts/cut_release.sh folio --dry-run`, then `scripts/cut_release.sh folio`: bumps
`services/web/package.json` (the MCP `serverInfo.version`), tags `folio-v<version>`. The push deploys
the Worker; the release runs `folio-testflight.yml` (the iPhone app and its Share extension, same
version; refuses until the in-app What's New describes it).

## 4b. iPhone app

- Bundle IDs `com.hejitech.folio` (Sign in with Apple, Push Notifications) and
  `com.hejitech.folio.share`; the Keychain group `com.hejitech.folio.shared` needs no portal setup.
- Auth: `folio://login-callback` is in the shared project's redirect list (Google), and
  `com.hejitech.folio` in the Apple provider's client IDs (native Sign in with Apple).
- App Store Connect app "Folio" (or `Folio: <descriptor>` if the name is taken); TestFlight tester
  per the root CLAUDE.md.

## 5. Docs

`https://tianhaoz95.github.io/hejitech-apps/folio/` builds from `docs/` on push (`pages.yml`).
