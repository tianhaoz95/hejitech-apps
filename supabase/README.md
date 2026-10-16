# Shared Supabase project

Every project in this repo uses one Supabase project (production ref `jitdzllkxfhlrxxvljhp`;
locally `supabase start` from the repo root, ports 554xx). This folder is the only migration
history, so all schema changes for all projects land here.

```sh
supabase start                       # local stack (project_id "waypack" kept so the local DB survives)
supabase migration new <project>_<what>   # e.g. waypack_price_alerts
supabase db push                     # production; still run by hand
```

## Conventions for a new project

- **Own schema.** Put its tables, views and functions in a schema named after the project
  (`create schema <project>;`), never in `public`. Add the schema to `[api] schemas` in
  `config.toml` (and to the production API settings) if clients call it through PostgREST.
  Waypack predates this and lives in `public`.
- **Own bucket.** One Storage bucket per project, named after it (Waypack's is `waypack`).
- **Migration names** start with the project: `<timestamp>_<project>_<what>.sql`. Never rename an
  applied migration: the version is what the remote history records.
- **Users are shared.** `auth.users` is one pool for every project: the same Google/Apple account
  is the same user id everywhere. Don't add triggers on `auth.users` that assume a user belongs to
  your project; create per-project rows when the user first uses that project. (Waypack's
  `on_auth_user_created` trigger still creates its `profiles`/`entitlements` row for every new
  user; see `projects/waypack/docs/DEPLOY.md`.)
- **Auth settings are project-wide**: site URL, redirect allow-list and providers. Add a new
  project's callback URLs to the allow-list; Apple's client IDs field takes a comma-separated list.
- **The service-role key bypasses RLS for every project.** Keep it server-side (Worker secrets).
- **Free-plan quotas are shared** (database size, storage, egress, monthly active users).
