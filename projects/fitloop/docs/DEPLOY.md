# Deployment

FitLoop runs on the shared HEJI Supabase project (`jitdzllkxfhlrxxvljhp`, schema and bucket
`fitloop`), one Cloudflare Worker (`https://fitloop.hejitech.workers.dev`), App Store Connect
(`com.hejitech.fitloop` with its Watch app) and the Even Hub. Steps in order; each says who does it.

## 1. Database (once)

```sh
supabase db push --dry-run     # from the repo root: should list only *_fitloop_init.sql
supabase db push
```

Then in the Supabase dashboard → API settings, add `fitloop` to the exposed schemas (read the list
first and extend it). The migration creates the private `fitloop` Storage bucket for progress photos.

## 2. Auth (once)

Read the current lists first, then extend them (the Site URL belongs to Waypack):

- Redirect URLs: `fitloop://login-callback` (iPhone Google sign-in) and
  `https://fitloop.hejitech.workers.dev/**` (web sign-in and agent consent).
- Apple provider → client IDs: `com.hejitech.fitloop`.

## 3. Worker

Cloudflare Workers Builds (dashboard, the owner): new project from this repo, root directory = repo
root, build `npm ci`, deploy `npm run deploy -w @fitloop/web`, non-production
`npm run upload-version -w @fitloop/web`, watch path `projects/fitloop/*`. The first deploy
provisions `OAUTH_KV`. One secret:

```sh
cd projects/fitloop/services/web
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
```

Smoke test:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://fitloop.hejitech.workers.dev/mcp     # 401 + OAuth hint
curl -s https://fitloop.hejitech.workers.dev/.well-known/oauth-authorization-server | jq .issuer
```

Then connect a real agent: in Claude, Settings → Connectors → Add custom connector →
`https://fitloop.hejitech.workers.dev/mcp`, sign in, and ask for a plan.

## 4. iPhone and Watch apps

1. App Store Connect (the owner): a new app record for `com.hejitech.fitloop` (category Health &
   Fitness). The first archive registers the App IDs and their capabilities (HealthKit, Sign in with
   Apple; the Watch app `com.hejitech.fitloop.watchkitapp` with HealthKit) through
   `-allowProvisioningUpdates`.
2. `scripts/cut_release.sh fitloop --dry-run`, then `scripts/cut_release.sh fitloop` from a clean,
   pushed, CI-green `main`. The first release ships `0.1.0`.
3. App Review notes: HealthKit is read for the user's own progress and shared only with the AI agent
   the user connects and allows; it's never used for ads. Privacy policy:
   `https://fitloop.hejitech.workers.dev/privacy/`, support `https://fitloop.hejitech.workers.dev/support/`.
   Privacy answers: email and user id; health and fitness data (app functionality, linked to the
   user, not used for tracking); photos (only if the user turns them on).

## 5. Even Hub plugin

The release attaches `fitloop-glasses-<version>.ehpk` (`fitloop-glasses-release.yml`). Everything the
portal asks, ready to paste and upload (text, category, tags, data rows, icon, background,
screenshots, reviewer note): `docs/even-hub/LISTING.md`; the portal's rules and quirks:
`.claude/skills/heji-even-hub-submit/SKILL.md`. Before submitting, install the Beta build on real
glasses and check the layout, every ring gesture, the exit dialog (the simulator doesn't draw it)
and five minutes with the phone locked (package `com.hejitech.fitloop.glasses`).

## 6. Docs

`https://tianhaoz95.github.io/hejitech-apps/fitloop/` builds from `docs/` on push (`pages.yml`).
