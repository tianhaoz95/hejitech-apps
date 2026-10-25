# HEJI projects monorepo

One public repo for several products. Each lives in `projects/<name>/` with its own Cloudflare
site/Worker, mobile and desktop apps, docs and release settings. They share one Supabase project,
one npm workspace and the CI plumbing.

| Project | What | README |
|---|---|---|
| Waypack | Offline trip bundles: MCP server + Worker site, Flutter app (iOS, Android, macOS) | [`projects/waypack`](projects/waypack/README.md) |
| Wee Hours | Hands-free newborn log: iPhone + watch app with on-device voice (Swift), Even G2 glasses app, site + MCP Worker | [`projects/weehours`](projects/weehours/README.md) |
| FeedbackKit | In-app feedback with a closed fix loop: SDKs (iOS/macOS/watchOS, Android, web, Flutter, React Native, desktop), dashboard, Portal apps, CLI + MCP. Own Supabase project (`BACKEND=own`) | [`projects/feedbackkit`](projects/feedbackkit/README.md) |
| Voxbrief | Voice memos on Apple Watch → clean Markdown notes on iPhone/Mac, transcribed and rewritten on the device (Swift, Whisper + Qwen3). No backend (`BACKEND=none`) | [`projects/voxbrief`](projects/voxbrief/README.md) |
| Meowtrix | Remote workspace for vibe engineering: self-hosted Node server (split panes of terminals, browsers, editor), macOS desktop apps (Tauri). No backend (`BACKEND=none`); standalone npm project with its own lockfile | [`projects/meowtrix`](projects/meowtrix/README.md) |
| Contempo | AI-native hour tracker for STR material-participation tests: Android + Wear OS (Kotlin), iOS + watchOS (Swift), web app + admin + API on its Worker. Moved off Firebase onto the shared Supabase project (schema `contempo`) | [`projects/contempo`](projects/contempo/README.md) |
| ToddlerCam | Dual-camera app for toddlers (front + rear at once, face-tracking masks, toddler lock) with an Apple Watch remote for the parent (Swift). Kids Category, no backend (`BACKEND=none`) | [`projects/toddlercam`](projects/toddlercam/README.md) |
| TinyTouch | Toddler lock + low-stimulation play on Apple Watch (touch shield, Digital Crown toys, 3-second parent hold) with an iPhone remote (Swift). Kids Category, no backend (`BACKEND=none`) | [`projects/tinytouch`](projects/tinytouch/README.md) |
| G2 Digest | A brief compiled ahead of time into glanceable cards for Even G2 glasses + R1 ring and pre-made audio: web app + brief editor + G2 preview, Even Hub plugin, MCP for the build agent (one Worker, TypeScript) | [`projects/g2digest`](projects/g2digest/README.md) |
| Headway | Caltrain status on Even G2 glasses + R1 ring and iPhone alerts (delays, cancellations, leave now, before your stop): Even Hub plugin, iPhone app (Swift), site + API + alert cron + MCP Worker (TypeScript) | [`projects/headway`](projects/headway/README.md) |

## Layout
```
projects/<name>/        everything one product owns (apps, services, packages, site, docs)
  release.env           how scripts/cut_release.sh releases it
supabase/               the shared Supabase project: config, schemas/<name>/, one migrations/ history
scripts/cut_release.sh  releases one project: scripts/cut_release.sh <name> [patch|minor|major|x.y.z]
scripts/db_migration.sh new migration for one project; check_supabase.mjs keeps projects apart
scripts/check_isolation.mjs, graduation_check.sh   each project can leave for its own Supabase (supabase/GRADUATION.md)
pages/                  the GitHub Pages site for every app (npm run pages:dev); project docs come from projects/<name>/docs
.claude/skills/         agent skills: heji-new-project, heji-migrate-project, heji-candidate-review, heji-fix-ci, heji-new-skill, heji-archive-reports, heji-build-next, heji-even-hub-submit (.agents/skills/ links them for Codex, Antigravity, Gemini CLI, Cursor…)
.github/workflows/      <name>-*.yml per project
.github/actions/        apple-signing (shared), <name>-toolchain
package.json            npm workspaces: projects/*/packages/*, projects/*/services/*, projects/*/apps/*
tsconfig.base.json      shared TypeScript settings
```

```sh
npm install                 # every project's workspaces
supabase start              # shared local stack (ports 554xx)
npm run build:waypack       # per-project scripts: build:<name>, test:<name>, typecheck:<name> (waypack, weehours, g2digest, headway)
```

## Adding a project
1. **Code** in `projects/<name>/`: Node packages under `packages/` or `services/`, apps under `apps/`
   (any of them with a `package.json` is picked up by the workspaces; name them `@<name>/…`). Add `build:`/`test:`/`typecheck:<name>`
   scripts to the root `package.json`.
2. **Backend:** `projects/<name>/backend.env` (copy Wee Hours'): which Supabase project it uses and
   the only files allowed to contain its coordinates. Projects share the HEJI project until they
   graduate to their own; keep that possible ([`supabase/GRADUATION.md`](supabase/GRADUATION.md)).
   **Database:** its own Postgres schema (named after the project, so the folder name must be a
   valid identifier) and Storage bucket. Tables go in `supabase/schemas/<name>/`; generate
   migrations with `scripts/db_migration.sh <name> <what>`. Read [`supabase/README.md`](supabase/README.md)
   first: users, auth settings, the service key and the plan's quota are shared (that's the point).
   Wee Hours is the worked example of a non-legacy project.
3. **CI:** `.github/workflows/<name>-ci.yml` with `paths:` covering `projects/<name>/**` and the
   shared root files (copy `waypack-ci.yml`). Release workflows trigger on `release: published`
   and must skip other projects' tags: `if: startsWith(github.event.release.tag_name, '<name>-v')`.
   Name its GitHub variables and secrets `<NAME>_…` (only the Apple team signing secrets are shared).
4. **Docs:** `projects/<name>/docs/` with an `index.md` (and optionally `pages.json` for the
   sidebar) appears on the site as `/<name>/`; add a card for the app to `pages/index.md`.
5. **Releases:** `projects/<name>/release.env` (copy Waypack's) with `TAG_PREFIX="<name>-v"` and
   `LATEST=false`. Waypack owns the repo's "latest" release: its installed Mac apps update from
   `releases/latest`.
6. **Cloudflare:** a Workers Builds project per Worker, root directory = repo root, deploy command
   `cd projects/<name>/services/<worker> && npm run deploy`, build watch paths `projects/<name>/*`.
7. **Apple/Google:** per-app bundle IDs under `com.hejitech.*`; signing secrets in `apple-signing`
   are team-wide and reusable.
