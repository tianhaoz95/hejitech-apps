# Deployment

Tether runs on the shared HEJI Supabase project (`jitdzllkxfhlrxxvljhp`, publishable key
`sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8`, schema and bucket `tether`), one Cloudflare
Worker (`https://tether.hejitech.workers.dev`), and App Store Connect (`com.hejitech.tether`).

## 1. Database (once)

```sh
supabase db push --dry-run     # from the repo root: should list only *_tether_init.sql
supabase db push
```

Then in the Supabase dashboard → API settings, add `tether` to the exposed schemas (read the list
first and extend it). The migration creates the private `tether` Storage bucket.

## 2. Auth (once)

Read the current lists first, then extend them:

- Redirect URLs: `tether://auth-callback` (mobile OAuth sign-in) and
  `https://tether.hejitech.workers.dev/**` (web sign-in and agent OAuth consent).
- Apple provider → client IDs: `com.hejitech.tether`.

## 3. Worker

Cloudflare Workers Builds (dashboard): new project from this repo, root directory = repo root,
build `npm ci`, deploy `npm run deploy -w @tether/web`, non-production
`npm run upload-version -w @tether/web`, watch path `projects/tether/*`. The first deploy
provisions `OAUTH_KV`. One secret:

```sh
cd projects/tether/services/web
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
```

Smoke test:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://tether.hejitech.workers.dev/mcp     # 401 + OAuth hint
curl -s https://tether.hejitech.workers.dev/.well-known/oauth-authorization-server | jq .issuer
```

## 4. iOS & Android Releases

1. App Store Connect: create an app record for `com.hejitech.tether` (category Developer Tools / Productivity).
2. Run `scripts/cut_release.sh tether --dry-run`, then `scripts/cut_release.sh tether` from a clean,
   pushed, CI-green `main`. The first release ships `0.1.0`.
3. Android APK / AAB is built via `./projects/tether/apps/android/gradlew -p projects/tether/apps/android :app:assembleRelease` and uploaded to Google Play Console.

## 5. Docs

`https://tianhaoz95.github.io/hejitech-apps/tether/` builds from `docs/` on push (`pages.yml`).
