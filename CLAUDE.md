# HEJI projects monorepo

Several products live in `projects/<name>/` (`waypack`, `weehours`, `feedbackkit`), sharing one Supabase
project (FeedbackKit keeps its own: `BACKEND=own`) (`supabase/`, read `supabase/README.md` before any schema change), npm workspaces and CI
plumbing. Layout and how to add a project: `README.md`. Keep each project self-contained; put
something at the root only when it is genuinely shared. Each project has its own `CLAUDE.md`
(`projects/<name>/CLAUDE.md`, loaded when you work there) for its commands, architecture and
decisions; keep this file about what they share. `AGENTS.md` files are symlinks to the `CLAUDE.md`
next to them, for Codex, Antigravity and other agents.

Sharing the Supabase project is temporary: a project moves to its own once its revenue pays for it,
and that must stay possible at any time. Never tie projects together: no references to another
project's code, packages, schema, bucket or CI settings, no shared sessions, and backend
coordinates only in the files a project lists in its `backend.env`. Products talk through public
APIs, never the database. Rules, checks (`check_isolation.mjs`, `graduation_check.sh`, run by
`supabase-ci.yml`) and the move itself: `supabase/GRADUATION.md`.

## Releases

Cut every release with `scripts/cut_release.sh <project>`. Don't improvise: no hand-made tags, no
`gh release create`, no running `tool/release_ios.sh` / `tool/release_mac.sh` in place of it.
The script keeps every surface on the same version and refuses to ship from a dirty, unpushed
or CI-red `main`.

```sh
scripts/cut_release.sh waypack --dry-run        # always look first (same for weehours)
scripts/cut_release.sh waypack                  # next patch; or: minor | major | 1.4.0
scripts/cut_release.sh waypack minor --notes "…" --watch
```

Per-project settings are in `projects/<name>/release.env`. For Waypack it bumps
`projects/waypack/apps/mobile/pubspec.yaml`, pushes (Cloudflare deploys the Worker + site), and
publishes GitHub Release `waypack-v<version>` (legacy tags were `v<version>`), which runs
`waypack-testflight.yml` (iOS → TestFlight) and `waypack-mac-release.yml` (notarized `Waypack.dmg`
attached to the release, served at `/download/mac`). CI assigns build numbers. Only Waypack may
mark its releases "latest": installed Mac apps update from `releases/latest`. Setup, secrets and
recovery: `projects/waypack/docs/DEPLOY.md` §4b.

For Wee Hours it bumps `MARKETING_VERSION` in `projects/weehours/apps/ios/project.yml`, pushes
(Cloudflare deploys the site + MCP Worker), and publishes `weehours-v<version>`, which runs
`weehours-testflight.yml` with the same team-wide Apple signing secrets. Setup:
`projects/weehours/docs/DEPLOY.md`.
