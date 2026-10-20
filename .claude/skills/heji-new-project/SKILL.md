---
name: heji-new-project
description: Start a brand-new app in this HEJI monorepo (projects/<name>/) on the shared Supabase project, with its own schema, Cloudflare Worker (site + API + MCP with its own OAuth), native/Flutter app, CI, releases, docs page and the isolation rules that let it graduate to its own backend later. Use when asked to create, scaffold, bootstrap or add a new project/app/product to hejitech-apps. For moving an existing repo in, use heji-migrate-project instead.
---

# Creating a new project in the monorepo

Distilled from building Waypack and Wee Hours here (2026-10). The rules live in the root
`CLAUDE.md`, `README.md` ("Adding a project"), `supabase/README.md` and `supabase/GRADUATION.md`;
`.claude/skills/heji-migrate-project/SKILL.md` has the detailed traps for each area. This is the order
of work for a project that starts from nothing, using Wee Hours as the reference implementation.

**Done means:** `projects/<name>/` builds and tests in `<name>-ci.yml`, ships with
`scripts/cut_release.sh <name>`, has a live Worker and docs page, and passes
`node scripts/check_supabase.mjs`, `node scripts/check_isolation.mjs` and
`scripts/graduation_check.sh <name>`.

## 1. Decide the few things only the user can

Name (lowercase identifier: folder = Postgres schema = Storage bucket = tag prefix `<name>-v`),
bundle id `com.hejitech.<name>`, surfaces (iPhone/watch, Flutter for Android/Mac, web, MCP), and
how users sign in (Google and Apple through the shared project; email sign-in is off project-wide).
Everything else below has a default; don't ask about it.

## 2. Skeleton

```
projects/<name>/
  README.md  CLAUDE.md  release.env  backend.env  .gitignore
  apps/<surface>/        iOS (XcodeGen project.yml), Flutter, glasses…
  services/web/          Cloudflare Worker: site + API + /mcp (@<name>/web)
  packages/<lib>/        shared TS (@<name>/core), consumed as source by web and apps
  docs/index.md  docs/pages.json  docs/decisions.md  docs/DEPLOY.md
```
- npm packages named `@<name>/…`; add `build:/test:/typecheck:<name>` to the root `package.json`.
  Use the repo's tool versions (vite, vitest, wrangler, TypeScript) instead of pinning new ones.
- Copy and adapt rather than invent: `projects/weehours/backend.env`, `release.env`,
  `services/web/{wrangler.jsonc,src/worker,vite.config.ts,.env.production}`, `scripts/test-mcp.mjs`.
- Start `docs/decisions.md` with the user's choices and why; keep it current.
- `projects/<name>/CLAUDE.md` (commands, architecture, decided options, pitfalls, releasing; see
  `projects/weehours/CLAUDE.md`) and `ln -s CLAUDE.md projects/<name>/AGENTS.md` for other agents.
  Update it whenever a change makes it wrong.

## 3. Database (shared Supabase project, own schema)

1. `supabase/schemas/<name>/schema.sql`: `create schema <name>;`, every object `<name>.`-qualified,
   RLS on every table, explicit grants (a new schema gets none of Supabase's defaults; a function
   that `revoke`s `public` needs `service_role` granted back if the Worker calls it), realtime
   tables declared with `alter publication supabase_realtime add table …`.
2. `supabase start` from the repo root (ports 554xx), `scripts/db_migration.sh <name> init`, then
   append by hand: `insert into storage.buckets` (`'<name>'`) and storage policies named `<name>: …`.
3. Seeds in `supabase/seeds/<name>.sql`. Users are shared by every app: create the project's rows
   on first use, never with triggers on `auth.users`.
4. Add `<name>` to `[api] schemas` in `supabase/config.toml` **after** the migration exists.
5. Clients select the schema per request: `Accept-Profile`/`Content-Profile: <name>` on raw
   PostgREST calls, `db: { schema: "<name>" }` in supabase-js. Delete Storage files through the
   Storage API (direct deletes from `storage.objects` are refused).
6. `scripts/graduation_check.sh <name>`: the migrations replay alone and match the declarative schema.

## 4. Worker (site, API, MCP)

- One Worker per project: Vite-built pages as static assets plus `src/worker/index.ts` with
  `@cloudflare/workers-oauth-provider` guarding `/mcp` (the project is its own OAuth server;
  Supabase's built-in OAuth server can't be used in the shared project). Personal access tokens via
  `resolveExternalToken`. See `projects/weehours/services/web/src/worker`.
- `wrangler.jsonc`: local vars on 127.0.0.1, `env.production` with `PUBLIC_URL`
  (`https://<name>.hejitech.workers.dev`), the shared Supabase URL and publishable key; KV without
  an id is provisioned on first deploy; secret `SUPABASE_SERVICE_ROLE_KEY`.
- Public build values in a committed `.env.production`; scripts `dev`, `dev:worker`, `deploy`,
  `upload-version`; integration test like `projects/weehours/scripts/test-mcp.mjs` (tokens and the
  full OAuth flow) run in CI against `wrangler dev`.
- MCP tools return facts and take typed input; share validation with the app through `@<name>/core`.

## 5. Apps

- Release builds talk to the hosted project (its coordinates live only in `BACKEND_FILES`), Debug
  builds to the local stack; keep launch-argument hooks (`-autoSignIn`, `-screen <name>`) so
  screens can be reached and screenshotted without taps.
- **Sign-in that works the first time** (both bit Wee Hours):
  - every sign-in path (Apple, Google, email) ends by re-routing to the right screen; don't call
    a once-per-launch `start()` again;
  - the Keychain survives deleting the app: on the first launch after an install, discard a
    leftover session, and give every post-sign-in screen a "use a different account" way out.
- Google: browser PKCE through Supabase (`/auth/v1/authorize?provider=google`, back to
  `<scheme>://login-callback`, then `token?grant_type=pkce`); Apple: native sheet with the bundle id
  added to the shared Apple client ids. No new OAuth clients needed.
- FeedbackKit: its own FeedbackKit project and key per app.

## 6. CI, releases, Cloudflare, docs

- `.github/workflows/<name>-ci.yml` (`paths:` = `projects/<name>/**` + shared root files) and
  release workflows filtering `<name>-v` tags, signing through `.github/actions/apple-signing`.
  Variables/secrets named `<NAME>_…`; only the Apple team secrets are shared.
- `release.env`: `TAG_PREFIX="<name>-v"`, `LATEST=false`, `VERSION_FILE` (pubspec.yaml,
  package.json or XcodeGen project.yml).
- Cloudflare Workers Builds (dashboard; the user does it): repo root, build `npm ci`, deploy
  `npm run deploy -w @<name>/web`, non-production `npm run upload-version -w @<name>/web`, watch
  path `projects/<name>/*`.
- Docs: `docs/index.md` (VitePress home layout) + `pages.json` appear at
  `https://tianhaoz95.github.io/hejitech-apps/<name>/`; add a card to `pages/index.md`, the
  FeedbackKit key to `pages/.vitepress/theme/index.ts`, and a row to the root README table.

## 7. Go live

1. Push; CI green (the project's, Supabase conventions with the graduation job).
2. Production: `supabase db push --dry-run` then `supabase db push`; expose `<name>` in the API
   settings; add redirect URLs and the Apple bundle id to the auth lists (read, then extend; the
   Site URL belongs to Waypack); deploy the Worker and set its secret; smoke-test `/mcp`, OAuth
   metadata, register/authorize/deny.
3. App Store Connect record for the bundle id (the user), then
   `scripts/cut_release.sh <name> --dry-run` and the real release.
4. FeedbackKit CI token as `<NAME>_FEEDBACKKIT_RELEASE_TOKEN`; allowed web origins for the docs site.

## 8. Verify like a user

Tests and CI aren't enough for the flows people hit first: run the Release build against
production on a device or simulator, sign in with each provider, reinstall, and walk the empty
states. A connected iPhone can be driven with `xcrun devicectl` (install, launch, `device capture
screenshot`); register it with the App Store Connect API if provisioning says it's unknown.
