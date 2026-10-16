# HEJI projects monorepo

One public repo for several products. Each lives in `projects/<name>/` with its own Cloudflare
site/Worker, mobile and desktop apps, docs and release settings. They share one Supabase project,
one npm workspace and the CI plumbing.

| Project | What | README |
|---|---|---|
| Waypack | Offline trip bundles: MCP server + Worker site, Flutter app (iOS, Android, macOS) | [`projects/waypack`](projects/waypack/README.md) |

## Layout
```
projects/<name>/        everything one product owns (apps, services, packages, site, docs)
  release.env           how scripts/cut_release.sh releases it
supabase/               the shared Supabase project: config + every project's migrations
scripts/cut_release.sh  releases one project: scripts/cut_release.sh <name> [patch|minor|major|x.y.z]
.github/workflows/      <name>-*.yml per project
.github/actions/        apple-signing (shared), <name>-toolchain
package.json            npm workspaces: projects/*/packages/*, projects/*/services/*
tsconfig.base.json      shared TypeScript settings
```

```sh
npm install                 # every project's workspaces
supabase start              # shared local stack (ports 554xx)
npm run build:waypack       # per-project scripts: build:<name>, test:<name>, typecheck:<name>
```

## Adding a project
1. **Code** in `projects/<name>/`: Node packages under `packages/` or `services/` (picked up by the
   workspaces; name them `@<name>/…`), Flutter apps under `apps/`. Add `build:`/`test:`/`typecheck:<name>`
   scripts to the root `package.json`.
2. **Database:** its own schema and Storage bucket, migrations named `<timestamp>_<name>_<what>.sql`
   in the shared `supabase/migrations`. Read [`supabase/README.md`](supabase/README.md) first: users,
   auth settings, the service key and the free-plan quota are shared.
3. **CI:** `.github/workflows/<name>-ci.yml` with `paths:` covering `projects/<name>/**` and the
   shared root files (copy `waypack-ci.yml`). Release workflows trigger on `release: published`
   and must skip other projects' tags: `if: startsWith(github.event.release.tag_name, '<name>-v')`.
4. **Releases:** `projects/<name>/release.env` (copy Waypack's) with `TAG_PREFIX="<name>-v"` and
   `LATEST=false`. Waypack owns the repo's "latest" release: its installed Mac apps update from
   `releases/latest`.
5. **Cloudflare:** a Workers Builds project per Worker, root directory = repo root, deploy command
   `cd projects/<name>/services/<worker> && npm run deploy`, build watch paths `projects/<name>/*`.
6. **Apple/Google:** per-app bundle IDs under `com.hejitech.*`; signing secrets in `apple-signing`
   are team-wide and reusable.
