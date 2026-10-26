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
```

Without the 511 token boards are timetable-only (`/api/status` says `realtime.configured: false`);
without the APNs key nothing is pushed (`push.configured: false`) and the app's Settings says alerts
aren't switched on. One APNs key serves every app of team 68CTFST8W2 (the topic is the bundle id).

Smoke test:

```sh
curl -s https://headway.hejitech.workers.dev/api/status | jq
curl -s "https://headway.hejitech.workers.dev/api/board?from=mountain_view&to=san_francisco" | jq '.live, .trains[0]'
curl -s -o /dev/null -w "%{http_code}\n" https://headway.hejitech.workers.dev/mcp            # 401 + OAuth hint
curl -s https://headway.hejitech.workers.dev/.well-known/oauth-authorization-server | jq .issuer
```

## 4. iPhone app

1. App Store Connect (the owner): a new app record for `com.hejitech.headway` (name "Headway",
   primary language English, category Travel / Navigation). Signing registers the App ID's
   capabilities (Push Notifications, Sign in with Apple, Time Sensitive Notifications) on the first
   archive through `-allowProvisioningUpdates`.
2. `scripts/cut_release.sh headway --dry-run`, then `scripts/cut_release.sh headway` from a clean,
   pushed, CI-green `main`. The first release ships `0.1.0` (what `project.yml` says).
3. The release runs `headway-testflight.yml` (team-wide signing secrets) and waits for App Store
   Connect's processing verdict.

Privacy answers for the listing: email address and user id (app functionality, linked to the user,
not used for tracking); no location, no analytics. Privacy policy:
`https://headway.hejitech.workers.dev/privacy/`; support: `https://headway.hejitech.workers.dev/support/`.

## 5. Even Hub plugin

The release attaches `headway-glasses-<version>.ehpk` (`headway-glasses-release.yml`). Everything the
portal asks, ready to paste and upload (text, category, tags, data rows, icon, background,
screenshots, reviewer note): `docs/even-hub/LISTING.md`; the portal's rules and quirks:
`.claude/skills/heji-even-hub-submit/SKILL.md`. Before submitting, install the Beta build on real
glasses and check the layout, every ring gesture, the exit dialog (the simulator doesn't draw it)
and five minutes with the phone locked (package `com.hejitech.headway.glasses`).

## 6. Docs

`https://tianhaoz95.github.io/hejitech-apps/headway/` builds from `docs/` on push (`pages.yml`).
