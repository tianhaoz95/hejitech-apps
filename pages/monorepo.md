# How the apps are built

All HEJI apps live in one public repository,
[`tianhaoz95/hejitech-apps`](https://github.com/tianhaoz95/hejitech-apps). Each app is
self-contained in `projects/<name>/`; what they genuinely share sits at the root.

| | Shared | Per app |
|---|---|---|
| Code | npm workspaces, TypeScript settings, CI plumbing | `projects/<name>/` (apps, services, docs, release settings) |
| Backend | One Supabase project (one plan) while apps are small | Its own Postgres schema and Storage bucket, named after it |
| Accounts | One sign-in (Google or Apple) works in every app | Each app's data stays in its own schema |
| Hosting | One Cloudflare account | Its own Worker (site, API, MCP + OAuth) |
| Releases | `scripts/cut_release.sh <app>` | Its own tags (`<app>-v1.2.3`), workflows and build numbers |
| Signing | One Apple developer team | Its own bundle ids (`com.hejitech.*`) |

## Shared backend, temporary by design

Sharing one Supabase project keeps costs at a single plan while the apps are small. It is a bridge,
not architecture: once an app earns enough to pay for its own backend, it **graduates** to its own
Supabase project, and that move has to be possible at any time. Every pull request checks it:

- each app's tables, views and functions are in its own schema, nothing in `public`, and nothing
  references another app's schema;
- each app's migrations replay **alone** on an empty Supabase project, and its declarative schema
  matches them;
- the backend address and keys appear only in the files an app lists in its `backend.env`;
- no app uses another app's code, packages, bucket or CI settings.

Apps talk to each other only through their public APIs, never the database. The rules and the
move itself: [`supabase/GRADUATION.md`](https://github.com/tianhaoz95/hejitech-apps/blob/main/supabase/GRADUATION.md).

## Releases

`scripts/cut_release.sh <app>` bumps the app's version, pushes (Cloudflare deploys its Worker),
and publishes a GitHub Release `<app>-v<version>`, which runs that app's workflows: TestFlight
for the iPhone apps, a notarized DMG for Waypack's Mac app. It refuses to ship from a dirty,
unpushed or CI-red `main`.

## Adding an app

The checklist is in the repository's
[README](https://github.com/tianhaoz95/hejitech-apps#adding-a-project): code in `projects/<name>/`,
a `backend.env`, its own schema and migrations, CI workflows named `<name>-*.yml`, a
`release.env`, a Worker, and docs in `projects/<name>/docs/`, which this site picks up
automatically.
