# Graduating a project to its own Supabase project

Projects start on the shared HEJI Supabase project (one plan, one quota) and move to their own once
their revenue pays for it. That move must be possible **at any time** and mechanical, so the repo
never lets projects tie into each other. The rules below are enforced on every PR by
`.github/workflows/supabase-ci.yml`; the procedure after them is what graduating then takes.

## Rules

Enforced (CI fails):

| Rule | Check |
|---|---|
| Tables, views, functions in the project's own schema (`<project>`; Waypack's grandfathered `public`), its own bucket (`<project>`); no references to other projects' schemas; nothing created in `auth`/`storage`; no triggers on `auth.users`; foreign keys only to its own schema and `auth.users` | `scripts/check_supabase.mjs` |
| Its migrations (`<ts>_<project>_*.sql`) and seed (`seeds/<project>.sql`) replay **alone** on an empty Supabase project | `scripts/graduation_check.sh <project>` |
| Its backend is declared in `projects/<project>/backend.env`; the Supabase ref, URL and publishable key appear only in the files listed there (`BACKEND_FILES`, all inside the project) | `scripts/check_isolation.mjs` |
| No paths into `projects/<other>/`, no `@<other>/` packages, no other project's schema or bucket in Supabase calls (`Accept-Profile`, `db.schema`, `.schema()`, `storage.from()`, `/storage/v1/object/…`) | `scripts/check_isolation.mjs` |
| Its workflows (`<project>-*.yml`) use only `<PROJECT>_…` variables/secrets plus the team-wide Apple signing ones: backend settings can't be shared by accident | `scripts/check_isolation.mjs` |

By convention (not machine-checkable; reviewers enforce):

- **Products talk through public APIs, never the database.** If Wee Hours ever needs Waypack data,
  it calls Waypack's Worker, which keeps working after either graduates.
- **No shared sessions.** Each app signs its users in itself and sends its tokens only to its own
  backend. A user who uses two apps is the same `auth.users` id today and, after graduation, the
  same id in both projects (users are copied with their ids), but never one session.
- **One server key per project.** Server code (Workers) gets the service key from its own secret
  (`SUPABASE_SERVICE_ROLE_KEY` in that Worker), never from another project's config. Prefer a
  separate Supabase secret API key per project (Settings → API keys → new secret key named after
  the project) so it can be rotated or revoked without touching the others.
- **Auth settings are written down per project** (its `docs/DEPLOY.md`): providers, client ids,
  redirect URLs, so they can be recreated in a new project.
- **Everything else is namespaced too:** storage paths inside its bucket, `pg_cron` jobs named
  `<project>_…`, realtime only on its own tables, extensions created with
  `if not exists … with schema extensions` in its own migrations.

## Procedure

1. **New Supabase project** on its own plan (same region if users are nearby). Recreate auth
   providers and redirect URLs from the project's `docs/DEPLOY.md`; Apple/Google client ids stay
   the same apps.
2. **Move its database source** into the project: `projects/<p>/supabase/` (`config.toml` copied from
   `supabase/` with its own `project_id`, ports and only its schema exposed), `git mv` its
   migrations (`supabase/migrations/*_<p>_*.sql`, plus any grandfathered ones listed for it in
   `check_supabase.mjs`), `supabase/schemas/<p>/` and `supabase/seeds/<p>.sql`. Set
   `BACKEND=own` and the new ref/URL/publishable key in `projects/<p>/backend.env`, and
   `supabase link` + `supabase db push` from `projects/<p>/`.
3. **Freeze writes** (maintenance window: the old backend's RLS write policies or the Worker) and
   **copy users** with their ids, only those the project references:
   ```sql
   -- run on the shared project; lists every column in <schema> with a foreign key to auth.users
   select format('select %I from %I.%I', a.attname, n.nspname, c.relname)
   from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
   join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
   where k.contype = 'f' and k.confrelid = 'auth.users'::regclass and n.nspname = '<schema>';
   ```
   Union those selects into the user id set, then copy `auth.users` and `auth.identities` rows for
   them (`pg_dump --data-only -t auth.users -t auth.identities` filtered to those ids, or
   `copy (select …) to stdout` / `copy … from stdin`) into the new project with the `postgres`
   role. Social sign-in needs no passwords; ids, emails and identities carry over.
4. **Copy data**: `pg_dump --data-only --schema=<schema> <shared db> | psql <new db>`, then the
   bucket's objects (Storage S3 protocol with `rclone`, or list + download/upload via the API).
5. **Point the project at the new backend**: edit exactly the files in `BACKEND_FILES`, set the
   `<PROJECT>_SUPABASE_*` GitHub variables, put the new project's service key in the Worker
   secret, deploy, and release the apps (`scripts/cut_release.sh <p>`). Installed app versions
   still point at the shared project: keep its copy read-only (or answering "please update") until
   they've updated.
6. **Clean up the shared project**: a last migration `<ts>_<p>_graduated.sql` that drops its
   schema (`drop schema <p> cascade`), its storage policies and realtime tables; empty and delete
   its bucket through the Storage API; remove its redirect URLs and client ids from the shared
   auth settings; take it out of `[api] schemas` in `supabase/config.toml` and the production API
   settings. Users who no longer use any shared app can be deleted later.
