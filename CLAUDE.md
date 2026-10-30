# HEJI projects monorepo

Several products live in `projects/<name>/` (`waypack`, `weehours`, `feedbackkit`, `voxbrief`, `meowtrix`, `contempo`, `toddlercam`, `tinytouch`, `g2digest`, `headway`, `fitloop`, `tether`, `tradeboard`), sharing one
Supabase project (FeedbackKit keeps its own: `BACKEND=own`; Voxbrief, Meowtrix, ToddlerCam and TinyTouch have none: `BACKEND=none`) (`supabase/`, read `supabase/README.md` before any schema change), npm workspaces and CI
plumbing. Layout and how to add a project: `README.md`. Keep each project self-contained; put
something at the root only when it is genuinely shared. Each project has its own `CLAUDE.md`
(`projects/<name>/CLAUDE.md`, loaded when you work there) for its commands, architecture and
decisions; keep this file about what they share. `AGENTS.md` files are symlinks to the `CLAUDE.md`
next to them, for Codex, Antigravity and other agents.

"Add a skill" always means a repo skill in `.claude/skills/heji-<name>/`, never a user-level one,
and every repo skill's name starts with `heji-`. Every skill, including any added later, also gets a
symlink `.agents/skills/heji-<name> -> ../../.claude/skills/heji-<name>` (`ln -s
../../.claude/skills/heji-<name> .agents/skills/heji-<name>`) so Codex, Antigravity, Gemini CLI,
Cursor and other agents can use it, and a mention in the `README.md` layout. Steps: the
`heji-new-skill` skill.

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
`weehours-testflight.yml` with the same team-wide Apple signing secrets and
`weehours-glasses-release.yml` (the Even G2 plugin `.ehpk`, same version, attached to the release;
upload it to the Even Hub portal by hand). Setup: `projects/weehours/docs/DEPLOY.md`.

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

For ToddlerCam it bumps `MARKETING_VERSION` in `projects/toddlercam/project.yml` and publishes
`toddlercam-v<version>`, which runs `toddlercam-testflight.yml` (iPhone app with the watch app and
complications embedded, same team-wide signing secrets). See `projects/toddlercam/CLAUDE.md`.

For TinyTouch it bumps `MARKETING_VERSION` in `projects/tinytouch/ToddlerPlay.xcodeproj/project.pbxproj`
(written by its own `tools/generate_project.py`, no XcodeGen) and publishes `tinytouch-v<version>`,
which runs `tinytouch-testflight.yml`. See `projects/tinytouch/CLAUDE.md`.

For G2 Digest it bumps the Even Hub plugin's version in `projects/g2digest/apps/glasses/package.json`
(stamped into `app.json` when packing) and publishes `g2digest-v<version>`, which runs
`g2digest-plugin-release.yml` (attaches the `.ehpk`, uploads it to Even Hub and promotes it to Beta;
submit for review in the portal). Its
Worker (web app, API, MCP) deploys on push. See `projects/g2digest/CLAUDE.md`.

For Headway it bumps `MARKETING_VERSION` in `projects/headway/apps/ios/project.yml` (refusing until the
in-app What's New describes the version) and publishes `headway-v<version>`, which runs
`headway-testflight.yml` (iPhone app with its Watch app) and `headway-glasses-release.yml` (the Even Hub plugin `.ehpk`, same version;
attaches the `.ehpk`, uploads it to Even Hub and promotes it to Beta; submit for review in the portal). Its Worker (site, API, the
every-minute realtime + alert cron, MCP) deploys on push. See `projects/headway/CLAUDE.md`.

For FitLoop it bumps `MARKETING_VERSION` in `projects/fitloop/apps/ios/project.yml` (refusing until the
in-app What's New describes the version) and publishes `fitloop-v<version>`, which runs
`fitloop-testflight.yml` (iPhone app with its Watch app) and `fitloop-glasses-release.yml` (the Even Hub
plugin `.ehpk`, same version; attaches the `.ehpk`, uploads it to Even Hub and promotes it to Beta;
submit for review in the portal). Its Worker (web app, API,
MCP) deploys on push. See `projects/fitloop/CLAUDE.md`.

For Tether it bumps `MARKETING_VERSION` in `projects/tether/apps/ios/project.yml` (refusing until the
in-app What's New describes the version) and publishes `tether-v<version>`, which runs
`tether-testflight.yml`. Its Worker (web workspace, API, MCP) deploys on push. See `projects/tether/CLAUDE.md`.

For the Trading Plan Board it bumps `projects/tradeboard/apps/executor/package.json` and publishes
`tradeboard-v<version>`, which runs `tradeboard-executor-release.yml` (tests, bundles the local
executor and attaches `tradeboard-executor.mjs`, `install.sh` and `policy.example.json`; the owner's
machine updates with `bash install.sh <version>`). Its Worker (portal, Board MCP, executor API, minute
cron) deploys on push. It handles real-money trading: never place a live order yourself. See
`projects/tradeboard/CLAUDE.md`.

For Polymath it releases `projects/polymath/apps/desktop/package.json`'s version as `polymath-v<version>`,
which runs `polymath-mac-release.yml` (signed & notarized Tauri macOS DMGs). Its Worker (site, docs, MCP)
deploys on push. See `projects/polymath/CLAUDE.md`.

## Common pitfalls

- **A green TestFlight upload isn't a build in TestFlight.** App Store Connect can accept an upload
  and reject the build minutes later while processing it; CI stays green and the build just never
  appears. Wee Hours lost 0.8.2–0.8.4 this way. Check the verdict with the App Store Connect API
  (`GET /v1/apps/{id}/buildUploads`: state `COMPLETE` or `FAILED` with Apple's errors), as
  `projects/weehours/scripts/asc_build_status.swift` does after every Wee Hours upload; the other
  projects' release scripts don't wait for it yet.
- **No "Apple" in App Intent strings.** Intent titles, descriptions, parameter names and App
  Shortcut phrases may not contain "Apple" (ITMS-90626, "Invalid Siri Support … cannot contain
  'apple'"), which rejects the whole build as above. Write "your watch", not "Apple Watch".
