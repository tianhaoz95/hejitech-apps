# Shared Supabase project

Every project in this repo uses one Supabase project (production ref `jitdzllkxfhlrxxvljhp`;
locally `supabase start` from the repo root, ports 554xx). This folder is the only migration
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
  `config.toml` (and to the production API settings) if clients call it through PostgREST.
  Waypack predates this: it lives in `public` with hand-written, unprefixed migrations (the
  check grandfathers the nine files from before the monorepo).
- **Own bucket.** One Storage bucket per project, named after it (Waypack's is `waypack`).
- **Declarative schema** in `supabase/schemas/<project>/`; generate migrations with
  `scripts/db_migration.sh` rather than writing them by hand. It always passes `--schema <project>`:
  an unscoped diff could read Waypack's `public` tables (absent from `schemas/`) as drops.
- **Migration names** start with the project: `<timestamp>_<project>_<what>.sql`. Never rename an
  applied migration: the version is what the remote history records.
- **Data statements** (bucket inserts, seed rows) aren't part of a declarative schema: add them to
  the generated migration by hand.
- **Users are shared.** `auth.users` is one pool for every project: the same Google/Apple account
  is the same user id everywhere. Don't add triggers on `auth.users` that assume a user belongs to
  your project; create per-project rows when the user first uses that project. (Waypack's
  `on_auth_user_created` trigger still creates its `profiles`/`entitlements` row for every new
  user; see `projects/waypack/docs/DEPLOY.md`.)
- **Auth settings are project-wide**: site URL, redirect allow-list and providers. Add a new
  project's callback URLs to the allow-list; Apple's client IDs field takes a comma-separated list.
- **The service-role key bypasses RLS for every project.** Keep it server-side (Worker secrets).
- **Free-plan quotas are shared** (database size, storage, egress, monthly active users).
