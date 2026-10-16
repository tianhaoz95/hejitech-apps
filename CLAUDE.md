# HEJI projects monorepo

Several products live in `projects/<name>/` (currently only `waypack`), sharing one Supabase
project (`supabase/`, read `supabase/README.md` before any schema change), npm workspaces and CI
plumbing. Layout and how to add a project: `README.md`. Keep each project self-contained; put
something at the root only when it is genuinely shared.

## Releases

Cut every release with `scripts/cut_release.sh <project>`. Don't improvise: no hand-made tags, no
`gh release create`, no running `tool/release_ios.sh` / `tool/release_mac.sh` in place of it.
The script keeps every surface on the same version and refuses to ship from a dirty, unpushed
or CI-red `main`.

```sh
scripts/cut_release.sh waypack --dry-run        # always look first
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
