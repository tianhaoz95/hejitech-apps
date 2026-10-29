# Shared Supabase project

Every project in this repo uses one Supabase project (production ref `jitdzllkxfhlrxxvljhp`;
locally `supabase start` from the repo root, ports 554xx) until it graduates to its own:
[`GRADUATION.md`](GRADUATION.md) has the rules that keep that possible and the procedure. This folder is the only migration
history, so all schema changes for all projects land here.

```
supabase/
  config.toml            one config for every project (auth, exposed schemas, storage)
  schemas/<project>/     a project's desired schema, declarative (*.sql, any subfolders)
  migrations/            the one flat migration history: <timestamp>_<project>_<what>.sql
```

```sh
supabase start                                  # local stack (project_id "waypack" kept so the local DB survives)
# edit supabase/schemas/<project>/*.sql, then:
scripts/db_migration.sh <project> <what>        # diffs only <project>'s schema → migrations/<ts>_<project>_<what>.sql
supabase db reset                               # apply locally; review the generated SQL
supabase db push                                # production; still run by hand
node scripts/check_supabase.mjs                 # the separation check CI runs (supabase-ci.yml)
```

The Supabase CLI only reads one flat `migrations/` folder, so projects are kept apart by folder in
`schemas/`, by migration name and by Postgres schema. `scripts/check_supabase.mjs` enforces it on
every PR: names carry a known project, SQL only touches its own schema (qualified names, nothing
created in `auth`/`storage`, no triggers on `auth.users`, only its own bucket). It's a lint over the
SQL text, so it catches mistakes rather than proving isolation.

## Conventions for a new project

- **Own schema.** Put its tables, views and functions in a schema named after the project
  (`create schema <project>;`), never in `public`. Add the schema to `[api] schemas` in
  `config.toml` (and to the production API settings) if clients call it through PostgREST, and
  only once a migration creates it: PostgREST fails its health check (locally `supabase start`
  times out) when an exposed schema doesn't exist. In production: `supabase db push` first, then
  expose it. Clients then select it per request (`Accept-Profile`/`Content-Profile` headers;
  supabase-js `db: { schema }`).
- **Grants.** A new schema gets none of Supabase's default privileges: grant `usage` on it and
  table privileges to `authenticated`/`service_role` explicitly, and remember that `revoke …
  from public` on a function also takes it from `service_role` unless you grant it back.
  `supabase/schemas/weehours/` shows the pattern.
  `public` belongs to no project. (Waypack lived there until 2026-10-16; its migrations from
  that time, unprefixed or written against `public`, are listed in `check_supabase.mjs` and checked
  as history.)
- **Own bucket.** One Storage bucket per project, named after it (Waypack's is `waypack`). Policies on
  `storage.objects` are shared by every project: prefix their names with the project. Storage
  refuses direct `delete from storage.objects`; delete files through the Storage API.
- **Declarative schema** in `supabase/schemas/<project>/`; generate migrations with
  `scripts/db_migration.sh` rather than writing them by hand. It always passes `--schema <project>`:
  an unscoped diff could read every other project's objects (absent from its `schemas/` folder)
  as drops.
- **Migration names** start with the project: `<timestamp>_<project>_<what>.sql`. Never rename an
  applied migration: the version is what the remote history records.
- **Data statements** (bucket inserts, storage policies) aren't part of a declarative schema: add
  them to the generated migration by hand. Publications are tracked by the diff, so declare
  `alter publication supabase_realtime add table …` in the schema, or the next diff drops it.
- **Seeds** for local development go in `seeds/<project>.sql` (all loaded by `supabase db reset`).
- **Users are shared.** `auth.users` is one pool for every project: the same Google/Apple account
  is the same user id everywhere. Don't add triggers on `auth.users` that assume a user belongs to
  your project; create per-project rows when the user first uses that project. (Waypack's
  `on_auth_user_created` trigger did; `*_waypack_lazy_user_rows.sql` dropped it.)
  Likewise **no project deletes an auth user**: "Delete account" in an app deletes that
  project's rows and files only, so it never signs anyone out of another HEJI app.
- **Auth settings are project-wide**: site URL, redirect allow-list and providers. Add a new
  project's callback URLs to the allow-list; Apple's client IDs field takes a comma-separated list
  (add each iOS bundle id for the native Sign in with Apple sheet). Supabase's built-in OAuth
  server has one consent URL (relative to the site URL) for the whole project, so projects that
  serve MCP run their own OAuth server in their Worker (Waypack, Wee Hours) instead.
- **Edge Functions** aren't used; server code lives in each project's Cloudflare Worker.
- **The service-role key bypasses RLS for every project.** Keep it server-side (Worker secrets).
- **Plan quotas are shared** (database size, storage, egress, monthly active users): sharing one
  plan is why the projects share this Supabase project.
