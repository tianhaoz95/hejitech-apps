---
name: migrate-project
description: Move an existing app repository into this HEJI monorepo (projects/<name>/) onto the shared Supabase project, with its history, CI, releases, Cloudflare Worker, docs and the isolation rules that let it graduate to its own backend later. Use when asked to absorb, import, merge or migrate another repo/project into hejitech-apps, or to add a project that already has its own Supabase/CI/release setup.
---

# Migrating a project into the monorepo

Distilled from moving Wee Hours (tianhaoz95/wee-hours) in on 2026-10-15/16, then FeedbackKit and
Voxbrief (sections at the end). Read the root
`CLAUDE.md`, `README.md` ("Adding a project"), `supabase/README.md` and `supabase/GRADUATION.md`
first: they are the rules; this is the order of work and the traps.

**Goal:** the project lives in `projects/<name>/`, runs on the shared Supabase project in its own
schema, ships through `scripts/cut_release.sh <name>`, and passes `check_supabase.mjs`,
`check_isolation.mjs` and `graduation_check.sh`, so it can leave for its own backend any day.

## 0. Survey before touching anything

- Old repo: `git status` clean and pushed, branches, open issues/PRs, releases/tags, workflows
  (especially **scheduled** ones), repo secrets (names), visibility.
- Its backend: is there a hosted Supabase project with real data? (Wee Hours had none, so the
  move was a clean re-home; with data, plan a copy like `GRADUATION.md` step 3–4 in reverse.)
- Collisions with existing projects: table names in `public` (Waypack and Wee Hours both had
  `entitlements`), bucket names, edge function names, ports, auth settings it needs
  (OAuth server, email sign-in, redirect URLs, site URL), CI secret names.
- Decide with the user only what's genuinely theirs (e.g. which OAuth design); everything below
  has a default.

## 1. Import with history

```sh
git fetch <path-or-url> main
git subtree add --prefix=projects/<name> <path-or-url> main -m "Import <Name> (<owner/repo>) with its history into projects/<name>"
```
Not squashed: original commit SHAs survive (FeedbackKit and similar tools check that fix commits
are ancestors of HEAD). Then restructure in follow-up commits with `git mv`.

- **Name** = folder = Postgres schema = bucket = tag prefix: lowercase identifier
  (`wee-hours` → `weehours`); match the bundle id where possible.
- **Layout:** `apps/` (iOS/Flutter/glasses…), `services/` (Workers, web), `packages/` (shared
  TS libs, `@<name>/…`), plus `spec/`, `docs/`, `scripts/` as the project had them. Move its
  `supabase/` out to the root (step 3) and its `.github/workflows/*` to `.github/workflows/<name>-*.yml`.
- **Shared code inside the project** becomes a workspace package (Wee Hours: `@weehours/core`),
  never a relative path into another folder. Paths into `projects/<other>/` are forbidden.
- **npm:** drop the project's lockfiles, add its packages to the root workspaces, align tool
  versions with the repo (vite/vitest/wrangler), `rm -rf projects/<name>/*/*/node_modules` if
  `npm install` hits ERESOLVE from stale nested installs. Add `build:/test:/typecheck:<name>`.
- **Per-project `.gitignore`** with paths relative to the project.
- Grep the project for every old path (`ios/`, `web/`, `supabase/functions`, `../../spec`,
  default CLI paths in tools such as `logeval`) and for the old local ports (`54321` → `55421`).

## 2. Isolation declarations

- `projects/<name>/backend.env` (copy `projects/weehours/backend.env`): `BACKEND=shared`, ref, URL,
  publishable key, `SCHEMA=<name>`, `BUCKET=<name>`, `EXTERNAL_SUPABASE_HOSTS` for third-party
  Supabase services (FeedbackKit), and `BACKEND_FILES`: the only files allowed to contain the
  coordinates. Keep that list short (one config per surface).
- Workflow variables/secrets named `<NAME>_…`; only the team-wide Apple signing secrets are shared.
- `node scripts/check_isolation.mjs` after every step that touches config.

## 3. Database on the shared Supabase project

1. Write the desired schema declaratively in `supabase/schemas/<name>/` (everything
   `<name>.`-qualified, `create schema <name>;`, functions with `set search_path = <name>, extensions`).
2. **Grants:** a new schema gets none of Supabase's defaults. `grant usage on schema` to
   `anon, authenticated, service_role`, table privileges to `authenticated, service_role`.
   `revoke … from public` on a function also takes it from `service_role`: grant it back if a
   Worker calls it.
3. **Realtime:** declare `alter publication supabase_realtime add table …` in the schema file
   (the diff tracks publications; hand-written ones get dropped by the next diff).
4. `supabase start` (shared stack, ports 554xx), then `scripts/db_migration.sh <name> init`.
   Append the data statements by hand: bucket insert (named `<name>`), storage policies on
   `storage.objects` with names prefixed `<name>: …`.
5. Seeds → `supabase/seeds/<name>.sql`. Never triggers on `auth.users`: create per-project rows
   on first use (users are shared by every app).
6. **Expose the schema** in `supabase/config.toml` `[api] schemas` **only once a migration creates
   it**: PostgREST fails its health check on a missing exposed schema (local start times out).
7. **Clients pick the schema per request:** raw PostgREST calls send
   `Accept-Profile`/`Content-Profile: <name>`; supabase-js `db: { schema: "<name>" }`. Rename the
   bucket in every Storage URL.
8. Storage refuses `delete from storage.objects`: delete files through the Storage API (this
   broke Wee Hours' "delete household" before the move too).
9. Verify: `supabase db reset`, a drift check (`scripts/graduation_check.sh <name>` replays its
   migrations alone and diffs the declarative schema), and the project's own integration tests
   (backend round trip, RLS as two different users, storage upload/list/delete).

## 4. Auth and server code

- Users, providers and the Site URL are **project-wide** and the Site URL belongs to Waypack.
  Add only: redirect URLs (site `https://<worker>/**`, app scheme `<scheme>://login-callback`),
  the iOS bundle id to Apple's comma-separated client ids. Read the current values first and
  PATCH the extended list (Management API `/v1/projects/<ref>/config/auth`); never replace.
- Email sign-in is off project-wide: keep email/password UI in Debug builds only.
- Google needs no new client: browser PKCE through Supabase `/auth/v1/authorize?provider=google`
  (ASWebAuthenticationSession on iOS, then `token?grant_type=pkce`), like Waypack.
- **No Supabase built-in OAuth server** (one consent URL per Supabase project) and **no Edge
  Functions**: MCP and other server code live in the project's Cloudflare Worker, which is its own
  OAuth server via `@cloudflare/workers-oauth-provider` (see `projects/weehours/services/web/src/worker`).
- Release builds point at the hosted project (its URL + publishable key in `BACKEND_FILES`);
  Debug builds at the local stack.
- Walk sign-in on a device against production before calling it done: every sign-in path must
  re-route to the right screen (Wee Hours' once-per-launch `start()` swallowed all three), and the
  Keychain survives reinstalls (forget a leftover session on the first launch after install; give
  household/onboarding screens a "use a different account" way out).

## 5. CI and releases

- `.github/workflows/<name>-ci.yml`: `paths:` = `projects/<name>/**` + shared root files; jobs for
  each surface, plus a backend job that starts the shared stack (replays every project's
  migrations) and runs the project's integration tests against its Worker (`wrangler dev`).
- Release workflows filter `startsWith(github.event.release.tag_name, '<name>-v')`, use
  `.github/actions/apple-signing` with the shared identities (verify the cert fingerprints match
  what the project's scripts pin before switching), and keep the project's build-number scheme
  if it's already higher than the repo's (Wee Hours keeps UTC timestamps).
- `projects/<name>/release.env`: `TAG_PREFIX="<name>-v"`, `LATEST=false`, no legacy prefix that
  collides (`v` is Waypack's). `cut_release.sh` reads pubspec.yaml, package.json or XcodeGen
  `project.yml` (`MARKETING_VERSION`); extend it for a new format. Old releases stay in the old repo.
- The first release from here: `scripts/cut_release.sh <name> patch` (so it's newer than what
  TestFlight already has), `--dry-run` first.

## 6. Cloudflare

- One Worker per project (site + API + MCP), `env.production` with public vars in
  `wrangler.jsonc`; secret `SUPABASE_SERVICE_ROLE_KEY` via `wrangler secret put … --env production`;
  KV without an id is provisioned on first deploy.
- Commit public build-time values (`.env.production`) so deploys need no dashboard variables.
- First deploy by hand (`npm run deploy -w @<name>/web`); **Workers Builds** (dashboard; wrangler's
  login can't create it): repo root, build `npm ci`, deploy `npm run deploy -w …`, non-production
  `npm run upload-version -w …`, watch paths `projects/<name>/*`. Delete the old repo's Worker.

## 7. Docs and site

- `projects/<name>/docs/index.md` (VitePress home layout) + `pages.json` (sidebar, static sites)
  appear at `https://tianhaoz95.github.io/hejitech-apps/<name>/`; add the app's card to
  `pages/index.md` and its FeedbackKit key to `pages/.vitepress/theme/index.ts`.
- Update the project's README/CLAUDE.md for the new paths (create `projects/<name>/CLAUDE.md` if it
  has none, plus an `AGENTS.md` symlink to it), record the user's decisions in its decisions log,
  and add it to the root README table and CLAUDE.md.

## 8. Production, in this order

1. Push the code (CI green; Workers Builds deploys other Workers on push).
2. `supabase db push --dry-run`, then `supabase db push` (only the expected migrations).
3. Expose the schema (Management API `/v1/projects/<ref>/postgrest`, append to `db_schema`).
4. Auth allow-lists (additive), Worker secret + deploy, smoke-test the live Worker
   (pages, `/mcp` 401 with discovery, OAuth metadata, register/authorize/deny).
5. `scripts/cut_release.sh <name> patch --watch`; confirm the upload in the workflow log.

## 9. Cut over

- Stop the old repo's scheduled workflows (archive or delete it; it may still upload builds).
- FeedbackKit (or similar): new CI token stored as `<NAME>_…` secret, repoint the project's
  GitHub repo, announce builds released before the token existed, allowed web origins for the
  docs site.
- Stop the old local stack; tell the user what's left that only they can do (dashboards, logins).

## Projects with their own backend and release machinery (from FeedbackKit, 2026-10-16)

- **Own backend:** `backend.env` with `BACKEND=own` (its `supabase/` stays in the project; the
  shared-project schema/bucket and coordinate rules don't apply; `BACKEND_FILES` may be
  `"projects/<name>/**"`). Projects that call it list its host in `EXTERNAL_SUPABASE_HOSTS`.
- **Workflows:** script the port, then review: prefix `paths:`, set workflow-level
  `defaults.run.working-directory: projects/<name>` *and* prefix every step-level
  `working-directory` (it's relative to the workspace, not the default) and path inputs
  (`cache-dependency-path`, artifact `path`, `hashFiles`, rust-cache `workspaces`); move local
  actions to `.github/actions/<name>-*`; namespace concurrency groups and generic agent labels
  (`claude` → `<name>-claude`). Validate every file with a YAML parser: a careless regex glues
  lines together and GitHub only says the workflow is invalid.
- **Tags:** every family gets the project prefix (`<name>-v…`, `<name>-cli-v…`, rolling betas).
  Release jobs must require it (an "anything except these families" condition also matches other
  projects' tags), strip it before parsing versions, and `git describe --match 'v*'` fallbacks must
  match the prefixed tags (`v*` here are Waypack's). Every `gh release create` gets `--latest=false`.
- **Repo identity is baked in:** grep for the old `owner/repo`. Release scripts that publish to a
  hardcoded repo get `${GITHUB_REPOSITORY}`; npm `--provenance` rejects packages whose
  `repository.url` isn't the publishing repo (set `directory` too); user-facing install links can
  keep pointing at the archived repo while it still serves old versions.
- **Signing:** check which identity each release workflow imports (FeedbackKit's TestFlight archive
  used the Apple *Development* cert) before mapping it onto `SIGNING_P12_*` (distribution) or
  `DEV_SIGNING_P12_*`.
- **Cutover:** import with history (no tags), freeze the old repo, port CI with publishes guarded,
  then in one sitting: push, rotate secrets both repos hold (e.g. a maintenance secret), disable
  every old workflow (`gh workflow disable`), repoint external services (FeedbackKit `github_repo`
  and dispatch labels, Supabase's GitHub integration directory, Cloudflare Workers Builds), add a
  "moved" notice to the old README, then the owner archives it.

## Apps without a backend, with their own updater or site (from Voxbrief, 2026-10-16)

- **No backend:** `backend.env` with `BACKEND=none` (empty coordinates, no `BACKEND_FILES`;
  third-party hosts such as FeedbackKit's still go in `EXTERNAL_SUPABASE_HOSTS`). Skip steps 3, 4,
  6 and 8.2–8.4; `graduation_check.sh` passes trivially.
- **In-app updaters:** grep for `releases/latest`, `api.github.com/repos/`, appcast URLs. In the
  monorepo `releases/latest` is Waypack's, so an app's updater must list releases and take its own
  newest `<name>-v` one (Voxbrief's `UpdateChecker.swift`), with a unit test. Installed copies still
  poll the old repo: after the first monorepo release, publish one last release there (old
  workflows disabled first) whose asset is the new build, so they hop over.
- **Version placeholders:** if the version file holds a constant (Voxbrief's `MARKETING_VERSION`
  was always `1.1`, the tag carried the version), set it to the last released version so
  `cut_release.sh` bumps from there; App Store Connect only needs higher versions. Project-specific
  release gates (Voxbrief's What's New) go in a `release_check` function in `release.env`.
- **Static sites:** a hand-written site (landing, privacy, support) moves to `projects/<name>/site/`
  and publishes through `docs/pages.json` `"static": {"site": "../site"}` at
  `/hejitech-apps/<name>/site/`. App Store Connect's privacy/support URLs point at the old
  `<user>.github.io/<repo>/` pages: replace the old repo's site with meta-refresh redirect stubs
  (plus a `404.html`), let its Pages workflow deploy once, then disable it. Archived repos keep
  serving Pages.
- **Release scripts:** test the paths CI never ran (`--no-upload`, no tag) with a
  `workflow_dispatch` validation run before the first release; macOS runners use bash 3.2, where
  `"${arr[@]}"` of an empty array fails under `set -u` (use `${arr[@]+"${arr[@]}"}`).

## Moving an already-live project's tables out of `public`

Done for Waypack on 2026-10-16 without downtime: (1) migration creating the empty schema + grants,
push, expose it; (2) Worker sends the profile headers and falls back to `public` on
`PGRST106/PGRST205/PGRST202`, deploy; (3) migration `alter table|view|function … set schema`
(rows, grants, RLS, indexes, triggers move; recreate functions whose bodies name `public`), push;
(4) remove the fallback, write the declarative schema from a `pg_dump --schema-only -n <name>`
and confirm no drift. List the historical migrations in `LEGACY_MIGRATIONS` (checked as `public`).
