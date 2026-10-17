# HEJI projects monorepo

Several products live in `projects/<name>/` (`waypack`, `weehours`, `feedbackkit`, `voxbrief`, `meowtrix`, `contempo`), sharing one
Supabase project (FeedbackKit keeps its own: `BACKEND=own`; Voxbrief and Meowtrix have none: `BACKEND=none`) (`supabase/`, read `supabase/README.md` before any schema change), npm workspaces and CI
plumbing. Layout and how to add a project: `README.md`. Keep each project self-contained; put
something at the root only when it is genuinely shared. Each project has its own `CLAUDE.md`
(`projects/<name>/CLAUDE.md`, loaded when you work there) for its commands, architecture and
decisions; keep this file about what they share. `AGENTS.md` files are symlinks to the `CLAUDE.md`
next to them, for Codex, Antigravity and other agents.

Repo skills live in `.claude/skills/<name>/`. Every skill, including any added later, also gets a
symlink `.agents/skills/<name> -> ../../.claude/skills/<name>` (`ln -s ../../.claude/skills/<name>
.agents/skills/<name>`) so Codex, Antigravity, Gemini CLI, Cursor and other agents can use it, and
a mention in the `README.md` layout.

Sharing the Supabase project is temporary: a project moves to its own once its revenue pays for it,
and that must stay possible at any time. Never tie projects together: no references to another
project's code, packages, schema, bucket or CI settings, no shared sessions, and backend
coordinates only in the files a project lists in its `backend.env`. Products talk through public
APIs, never the database. Rules, checks (`check_isolation.mjs`, `graduation_check.sh`, run by
`supabase-ci.yml`) and the move itself: `supabase/GRADUATION.md`.

## Testing on devices

Always prefer the connected physical device over a simulator/emulator when testing mobile apps
(an iPhone is usually attached: `xcrun devicectl list devices`; Android: `adb devices`). Use a
simulator only when no device is connected or the test can't run on one, and say so. Debug device
builds sign with the team's existing Apple Development identity via the App Store Connect API key
(`-allowProvisioningUpdates` with `-authenticationKey…`); never let signing mint a new certificate.

## Releases

Cut every release with `scripts/cut_release.sh <project>`. Don't improvise: no hand-made tags, no
`gh release create`, no running `tool/release_ios.sh` / `tool/release_mac.sh` in place of it.
The script keeps every surface on the same version and refuses to ship from a dirty, unpushed
or CI-red `main`.

```sh
scripts/cut_release.sh waypack --dry-run        # always look first (same for the others)
scripts/cut_release.sh waypack                  # next patch; or: minor | major | 1.4.0
scripts/cut_release.sh waypack minor --notes "…" --watch
```

Every iOS app's TestFlight workflow also runs weekly on Wednesday from `main` (staggered from
17:00 UTC): same version, new build number, so builds never expire and the delivery path is tested
end to end. A new iOS project's workflow gets the same `schedule:`.

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

For Voxbrief it bumps `MARKETING_VERSION` in `projects/voxbrief/project.yml` (refusing until the
in-app What's New describes the version), and publishes `voxbrief-v<version>`, which runs
`voxbrief-testflight.yml` and `voxbrief-mac-release.yml` (notarized DMG on the release; the Mac
app finds it by listing `voxbrief-v` releases, not `releases/latest`). See
`projects/voxbrief/CLAUDE.md`.

For Meowtrix it releases `package.json`'s version (pass it: `scripts/cut_release.sh meowtrix 1.35.0`)
as `meowtrix-v<version>`, which runs `meowtrix-release.yml` (server tarballs) and
`meowtrix-mac-release.yml` (DMGs + Tauri updater). Both refresh the rolling prerelease
`meowtrix-latest`, the stable URLs installs and updaters read instead of `releases/latest`. See
`projects/meowtrix/CLAUDE.md`.

For Contempo it bumps `MARKETING_VERSION` in `projects/contempo/ios/project.yml` and publishes
`contempo-v<version>`, which runs `contempo-testflight.yml` (bundled model fetched in CI, same
team-wide signing secrets). Android goes to Play Console by hand. See `projects/contempo/CLAUDE.md`.
