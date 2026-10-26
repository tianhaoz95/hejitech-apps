# Deployment

G2 Digest is one Cloudflare Worker (web app, API, feed, MCP + OAuth) on the shared HEJI Supabase
project (schema and bucket `g2digest`), plus the Even Hub plugin package. Backend coordinates live
only in the files `backend.env` lists.

| What | Where |
|---|---|
| Web app + API + MCP | `https://g2digest.hejitech.workers.dev` (Worker `g2digest`, `services/web`) |
| Supabase | `https://jitdzllkxfhlrxxvljhp.supabase.co`, schema `g2digest`, bucket `g2digest` (private) |
| Plugin | `apps/glasses` → `build/g2digest.ehpk`, attached to each `g2digest-v<version>` GitHub Release |

## 1. Database

```sh
supabase db push --dry-run          # from the repo root: only *_g2digest_*.sql should be pending
supabase db push
```

Then **Settings → API → Exposed schemas**: add `g2digest` (after the push; an exposed schema that
doesn't exist breaks PostgREST).

## 2. Auth (shared settings: read, then extend; the Site URL belongs to Waypack)

- Provider: **Google** (already on for the shared project; no new client needed).
- Redirect URLs to add: `https://g2digest.hejitech.workers.dev/**`.
- Email sign-in stays off; local development uses the seed account.

## 3. Worker

```sh
npm run deploy -w @g2digest/web                                   # from the repo root
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production -c projects/g2digest/services/web/wrangler.jsonc
```

Use a separate Supabase secret key named `g2digest` (Settings → API keys) so it can be rotated
alone. The OAuth KV namespace is created on the first deploy.

Cloudflare Workers Builds (dashboard): repo root, build `npm ci`, deploy
`npm run deploy -w @g2digest/web`, non-production `npm run upload-version -w @g2digest/web`, watch
path `projects/g2digest/*`.

Smoke test: `/`, `/preview/fixture`, `/.well-known/oauth-authorization-server`, `POST /mcp` without
a token (401 with `resource_metadata`).

## 4. Plugin

- Load the hosted page on the glasses with no package: `evenhub qr --url https://g2digest.hejitech.workers.dev/glasses/`
  (add `?pair=123456` with a fresh code to pair on launch).
- Package: `npm run package -w @g2digest/glasses` → `projects/g2digest/apps/glasses/build/g2digest.ehpk`;
  upload it in the Even Hub portal (`evenhub login`). The network whitelist in `app.json` is the
  Worker origin and the Supabase origin (signed audio URLs).
- Release: `scripts/cut_release.sh g2digest` bumps `apps/glasses/package.json`, tags
  `g2digest-v<version>`, and `g2digest-plugin-release.yml` attaches the `.ehpk`.

### Even Hub submission

Listing text, icon, background and screenshots: `docs/even-hub/LISTING.md`. The portal's forms, limits and review rules for every HEJI plugin: the `heji-even-hub-submit` skill. In the portal: upload
the release's `.ehpk` as a **Beta** build, install it on the glasses as a beta tester (QR sideloads
die when the phone locks, so they can't check the rest), then go through the review checklist:

- [ ] First launch, unpaired: the tour shows within a few seconds, never a black screen.
- [ ] Every gesture answers on every card: swipe moves, tap and tap-then-hold flash on the tour.
- [ ] Double-tap with nothing playing opens the **system** exit dialog; confirming closes the phone
      page too; Conversate then opens without a restart. Exit in the contextual menu does the same.
- [ ] Phone locked, Even app in the background, 5 minutes: still alive and responsive.
- [ ] Pair with a code, read an edition, play a glance and a deep dive, double-tap stops audio first.
- [ ] Release notes for `en` (1–3 lines), then the tag → **Public** → submit.

Published versions are immutable: a fix needs a higher version (`cut_release.sh`), so the build
under review must be the one on the release.

## 5. The audio spike (do first on hardware, PRD §7.3)

`evenhub qr --url https://g2digest.hejitech.workers.dev/spike/`, press Start, lock the phone for
30–120 s, tap the ring while locked, unlock. The page prints PASS/FAIL with how far audio advanced
and which ring events arrived. Record the result in `docs/decisions.md`. On FAIL, users switch the
plugin's Audio setting to "In my podcast app" and add the feed from the Pair page.

## 6. Build agent

See `pipeline/README.md`: the MCP URL, a `g2a_` token from the Pair page (or OAuth), and
`pipeline/build-prompt.md` on a schedule before the brief's delivery time.

## Graduating

Edit exactly the files in `backend.env`'s `BACKEND_FILES`, per `supabase/GRADUATION.md`.
