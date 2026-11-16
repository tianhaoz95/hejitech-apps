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
npx wrangler secret put APPLE_SIWA_KEY_ID --env production           # a Sign in with Apple key (developer portal → Keys, primary App ID com.hejitech.fitloop)
npx wrangler secret put APPLE_SIWA_PRIVATE_KEY --env production      # that key's .p8 contents: account deletion revokes the Apple token (src/worker/apple.ts)
```

Smoke test:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://fitloop.hejitech.workers.dev/mcp     # 401 + OAuth hint
curl -s https://fitloop.hejitech.workers.dev/.well-known/oauth-authorization-server | jq .issuer
```

Then connect a real agent: in Claude, Settings → Connectors → Add custom connector →
`https://fitloop.hejitech.workers.dev/mcp`, sign in, and ask for a plan.


### Pro on the web (Stripe) and App Store notifications

Set up 2026-11-16 (decisions: "Pro on every platform"). Stripe is the shared HEJI account; the
product, the yearly and lifetime prices and the webhook (`https://fitloop.hejitech.workers.dev/stripe/webhook`,
five events) come from `node scripts/stripe_pro.mjs fitloop --live` (idempotent; ids and the webhook
secret in `~/Credentials/stripe.env`, `FITLOOP_STRIPE_*`). The price ids are `env.production.vars` in
`wrangler.jsonc`; the keys are secrets:

```sh
npx wrangler secret put STRIPE_SECRET_KEY --env production       # HEJI_TECHNOLOGY_LIVE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production   # FITLOOP_STRIPE_WEBHOOK_SECRET
```

App Store Server Notifications V2 (production and sandbox) go to `/appstore/notifications`:
`node .claude/skills/heji-app-store-iap/iap.mjs notifications com.hejitech.fitloop https://fitloop.hejitech.workers.dev/appstore/notifications`.
Locally, put the sandbox key and `node scripts/stripe_pro.mjs fitloop`'s price ids in `.dev.vars`.

Google Play: the products `pro_annual` (subscription, base plan `yearly`, offer `free-week`) and
`pro_lifetime` (one-time) need a build with Play Billing on a track first. The Worker reads purchases
with a service account that has this app's "View financial data" and "Manage orders and
subscriptions" in Play Console: `PLAY_SA_EMAIL` (var) and `PLAY_SA_KEY` (secret, the JSON's private_key).

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
   Privacy answers (published 2026-11-12): email, user id, health, fitness, photos (progress photos)
   and other user content (check-ins, notes for the agent), all app functionality, linked to the
   user, not used for tracking.
4. Price (owner's call; paid upfront 2026-11-13, then on 2026-11-14 changed to a free download with
in-app purchases): **FitLoop Pro**, needed for the whole iPhone app after a 1-week free trial, as the
yearly subscription `com.hejitech.fitloop.pro.annual` ($19.99/yr, the trial is its introductory
offer) or the lifetime unlock `com.hejitech.fitloop.pro.lifetime` ($39.99 once). The App Store price of
the app itself is Free. StoreKit 2 checks the purchase on the phone (`ProStore.swift`, `ProViews.swift`:
the gate, the purchase screen, Settings › FitLoop Pro); no server is involved, so the web app, glasses
and Android aren't gated. Debug builds skip the gate with `-proUnlocked`. Pro for free by email (testers, early adopters, the
owner): `scripts/grant_pro.sh fitloop <email> [--until YYYY-MM-DD] [--revoke] | --list`; the person taps "Have a
Pro invite? Sign in" on the purchase screen. Products, review
screenshots and notes: skill `heji-app-store-iap` (`iap.mjs status com.hejitech.fitloop`).
   Google Play keeps its one-time $9.99 until Play Billing is added (Play can go paid → free but never back). Store text: `apps/ios/AppStore/description.txt`;
   captioned slides: `node scripts/store_captions.mjs projects/fitloop/apps/ios/AppStore/captions.json`.

## 5. Even Hub plugin

The release attaches `fitloop-glasses-<version>.ehpk`, uploads it to Even Hub and promotes it to Beta
(`fitloop-glasses-release.yml`). Everything the
portal asks, ready to paste and upload (text, category, tags, data rows, icon, background,
screenshots, reviewer note): `docs/even-hub/LISTING.md`; the portal's rules and quirks:
`.claude/skills/heji-even-hub-submit/SKILL.md`. Before submitting, install the Beta build on real
glasses and check the layout, every ring gesture, the exit dialog (the simulator doesn't draw it)
and five minutes with the phone locked (package `com.hejitech.fitloop.glasses`).

## 6. Docs

`https://tianhaoz95.github.io/hejitech-apps/fitloop/` builds from `docs/` on push (`pages.yml`).
