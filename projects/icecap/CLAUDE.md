# Icecap

A residential real estate investment analyzer: a Chrome extension that scores Redfin, Zillow and
Realtor.com listings as you browse (long-term rental, short-term rental, flip, BRRRR), and a web
dashboard for saved deals. Shared HEJI Supabase project (schema `icecap`), one Cloudflare Worker,
Pro through the shared HEJI Stripe account, AI on the device only (Chrome's built-in model). Moved in
from `tianhaoz95/icecap` off Firebase on 2026-11-17: `docs/decisions.md`.

## Layout

- `apps/extension/` (`@icecap/extension`): Chrome MV3 extension built with Vite (`scripts/build.mjs`,
  no Plasmo). `manifest.config.ts` writes the manifest. `src/contents/` are the content scripts
  (scraping + map-pin badges, built as classic IIFE files), `src/sidepanel.tsx` the side panel,
  `src/core/icecap.ts` the client (session in `chrome.storage.local`, Google sign-in through
  `chrome.identity.launchWebAuthFlow` + Supabase PKCE), `src/core/math.ts` the extension's own
  copy of the deal math (the content scripts' quick estimates).
- `services/web/` (`@icecap/web`): one Vite build of several React pages, served with the API by one
  Worker. `index.html` + `src/home` (home page + waitlist), `app/` + `src/app` (dashboard, router
  base `/app`), `admin/` + `src/admin` (base `/admin`), `privacy/`, `terms/` + `src/legal`,
  `promo/` + `src/promo` (ad mockups, hash router). `src/lib/icecap.ts` is the pages' client and
  hooks. `src/worker/`: `index.ts` (routing, SPA deep links), `api.ts` (all `/api/*`), `billing.ts`
  + `pro-config.ts` (Stripe, same code as the other HEJI Workers), `store.ts` (service-role client).
- `packages/`: `@icecap/types`, `@icecap/math` (the metrics, the single source of truth for the web),
  `@icecap/ui` (shared components), `@icecap/theme` (Tailwind 4 tokens, `theme.css`),
  `@icecap/ai` (prompts + the Prompt API wrapper), `@icecap/client` (Supabase + API client; its
  `config.ts` holds the backend coordinates).
- `scripts/`: `test-api.mjs` (integration test), `make_admin.sh`.
- `docs/`: the site's Icecap pages, `decisions.md`, `DEPLOY.md`; `docs/archive/` holds the old repo's
  design notes and reports (Firebase era, kept as they were).
- Schema: `supabase/schemas/icecap/` (`schema.sql`, `billing.sql`), seeds `supabase/seeds/icecap.sql`.

## Commands

```sh
npm run typecheck:icecap
npm run test:icecap
npm run build:icecap
npm run package -w @icecap/extension          # icecap-extension-<v>.zip (Web Store) + -sideload.zip

# local stack: supabase start (repo root), then
echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o json | jq -r .SERVICE_ROLE_KEY)" > projects/icecap/services/web/.dev.vars
npm run dev:worker -w @icecap/web            # every page + API on http://127.0.0.1:8800 (dev build)
node projects/icecap/scripts/test-api.mjs     # RLS, API, routing against it
npm run build:dev -w @icecap/extension        # load projects/icecap/apps/extension/dist unpacked
node projects/icecap/apps/extension/test/smoke.mjs   # the dev extension in Chromium (Playwright)
```

Development builds (`--mode development`) point at the local stack (`@icecap/client` `config.ts`)
and show "Sign in as the local test user" (`pro@icecap.test` / `icecap-dev-123`: Pro by grant, an
admin; `free@icecap.test` has no Pro).

## Rules and gotchas

- **AI is on-device only** (owner's decision): `@icecap/ai` wraps Chrome's `LanguageModel` (Prompt
  API). No cloud model, no API keys, no quotas. Where it's unavailable the AI features say so.
- **Pro** comes only from `GET /api/pro` (Stripe purchases + `pro_grants`). The extension and the web
  co-pilot need it; the dashboard needs only a sign-in.
- **Two extension ids:** the Web Store assigns `gbjiibgccfkpodffchmnokflclbnbfpl`; the manifest `key`
  pins unpacked/sideload builds to `cljkjphaofjfagcekpbnkonpepdcciba`. The store zip has no `key`.
  Both `chromiumapp.org` redirect URLs are on the shared Supabase allow-list.
- **React 18 lives at the repo root** (other projects): the web and extension builds `dedupe`
  React, and the tsconfigs map `react` types to React 19's. Keep both when adding React libraries.
- Users are shared HEJI accounts: "Delete my data" removes deals and settings, never the sign-in.
- Releases: `scripts/cut_release.sh icecap` (tags `icecap-v`); the Worker deploys on push.
