# Deployment

Icecap is one Cloudflare Worker (every page + the API) on the shared HEJI Supabase project (schema
`icecap`), plus the Chrome extension. Backend coordinates live only in the files `backend.env` lists.

| What | Where |
|---|---|
| Home + waitlist, dashboard `/app/`, admin `/admin/`, privacy, terms, promo studio, `/api` | `https://icecap.hejitech.workers.dev` (Worker `icecap`, `services/web`) |
| Supabase | `https://jitdzllkxfhlrxxvljhp.supabase.co`, schema `icecap` (no Storage used yet; bucket name reserved) |
| Chrome extension | `apps/extension` → `icecap-extension-<version>.zip` (Web Store) and `-sideload.zip`, attached to each `icecap-v<version>` GitHub Release |
| Stripe | the shared HEJI account, product "Icecap Pro" (metadata `app=icecap`) |

## 1. Database

```sh
supabase db push --dry-run          # from the repo root: only *_icecap_*.sql should be pending
supabase db push
```

Then expose `icecap` (Management API `/v1/projects/<ref>/postgrest`, append to `db_schema`; or
Settings → API → Exposed schemas), after the push: an exposed schema that doesn't exist breaks
PostgREST.

## 2. Auth (shared settings: read, then extend; the Site URL belongs to Waypack)

- Provider: **Google** (already on for the shared project; no new client needed).
- Redirect URLs added: `https://icecap.hejitech.workers.dev/**`,
  `https://gbjiibgccfkpodffchmnokflclbnbfpl.chromiumapp.org/**` (the Web Store's id) and
  `https://cljkjphaofjfagcekpbnkonpepdcciba.chromiumapp.org/**` (unpacked and sideloaded builds,
  pinned by the manifest `key`).
- Email sign-in stays off; local development uses the seed accounts (`supabase/seeds/icecap.sql`).

## 3. Worker

```sh
npm run deploy -w @icecap/web                                   # from the repo root
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production -c projects/icecap/services/web/wrangler.jsonc
```

Cloudflare Workers Builds (dashboard): repo root, build `npm ci`, deploy
`npm run deploy -w @icecap/web`, non-production `npm run upload-version -w @icecap/web`, watch path
`projects/icecap/*`.

Smoke test: `/`, `/app/`, `/privacy/`, `GET /api/waitlist` (a count), `GET /api/pro` without a
session (401).

## 4. Pro (Stripe)

`node scripts/stripe_pro.mjs icecap --live` (idempotent) makes the product, the yearly ($99.99,
7-day free trial on the first purchase) and lifetime ($199.99) prices and the webhook
`https://icecap.hejitech.workers.dev/stripe/webhook`. Price ids are `env.production.vars` in
`wrangler.jsonc`; the keys are secrets (also in `~/Credentials/stripe.env` as `ICECAP_STRIPE_*`):

```sh
npx wrangler secret put STRIPE_SECRET_KEY --env production -c projects/icecap/services/web/wrangler.jsonc       # HEJI_TECHNOLOGY_LIVE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production -c projects/icecap/services/web/wrangler.jsonc   # printed by stripe_pro.mjs
```

Free Pro: `scripts/grant_pro.sh icecap <email> [--until YYYY-MM-DD]`, or the admin page.
Admins: `projects/icecap/scripts/make_admin.sh <email>`.

## 5. Chrome extension

`scripts/cut_release.sh icecap` (version in `apps/extension/package.json`) publishes
`icecap-v<version>`; `icecap-extension-release.yml` attaches both zips. Upload
`icecap-extension-<version>.zip` in the Chrome Web Store developer dashboard (listing
`gbjiibgccfkpodffchmnokflclbnbfpl`) by hand. The listing's privacy policy URL is
`https://icecap.hejitech.workers.dev/privacy/`.

## Before the move

The Firebase project `icecap-platform` (Hosting sites `icecap-hub`, `-admin`, `-home`, `-platform`,
`-docs`, `-preview-list`, `-promo`) and the old repo's Stripe keys belong to the old version; nothing
here uses them.
