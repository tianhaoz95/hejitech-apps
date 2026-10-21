---
name: heji-build-next
description: Go through every project in this HEJI monorepo one by one, find the next most valuable thing to build for each (a feature, a quality/performance improvement or a bug fix), build it autonomously on a local-only feature branch (never pushed), capture it running (real screenshots, screen recordings turned into GIFs), then compose everything into a heji-candidate-review site where the user picks what to merge. When the user pastes the hand-off back, merge the picked branches into main, delete every build branch, push and release the projects that changed. Use when asked to "build the next thing for every project", "find and build what's most valuable", "do a build round", "autonomous improvements across the repo", or invoked as /heji-build-next; also when a pasted hand-off says it is a heji-build-next review.
---

# Build the next thing, for every project

The loop: **for each project: pick → build on a local branch → verify → capture → (next project)
→ review site → user picks → hand-off pasted back → merge picks → delete all build branches →
push main → release what changed.**

Two phases, two different sessions possibly:

- **Phase A (§1–§5)** runs autonomously: don't stop to ask between projects. Ask only if
  something blocks the whole run (no `gh` auth, main is dirty).
- **Phase B (§6)** starts when the user pastes the hand-off ("Copy summary" from the review). The
  paste is the user's approval to merge, push and release exactly what it lists, nothing else.

Hard rules for the whole skill:

- **A build branch never leaves this machine.** Never `git push` a `heji-build/*` branch, never
  open a PR from one, never set an upstream. `worktree.sh` installs a pre-push hook that refuses
  them; don't remove or bypass it. Only main is pushed, in §6.
- **Main stays untouched in phase A.** All code goes into the per-project worktree. The only
  thing written in the main checkout is the review site in `reports/`, left uncommitted until §6.
- **Respect each project.** Read root `CLAUDE.md` and `projects/<name>/CLAUDE.md` before
  touching a project; follow its commands, conventions, What's New rules and isolation rules
  (`supabase/GRADUATION.md`). One project's branch touches only `projects/<name>/` (plus its own
  `.github/workflows/<name>-*.yml` if the build truly needs it).

## 0. Preflight

```sh
git status --porcelain            # must be empty; if not, stop and ask (don't stash the user's work)
git switch main && git pull --ff-only
.claude/skills/heji-build-next/worktree.sh list   # leftover heji-build branches from an earlier run?
```

Leftover build branches mean an earlier round wasn't merged or cleaned up: ask whether to drop
them (`worktree.sh cleanup`) before starting. Note the date: branches and the report use it.

## 1. Pick the next most valuable thing (per project)

Go through `projects/*/` in order (`ls projects`). For each, spend real effort finding
candidates, then pick **one** to build. Evidence, roughly by weight:

1. **Broken things users hit**: open GitHub issues for the project (`gh issue list --search
   "<name> in:title,body"`, labels), FeedbackKit reports the project receives, crash/error logs,
   failing or flaky tests (`gh run list --workflow <name>-ci.yml`), App Store Connect rejections.
2. **Decisions already made but not built**: picks and "next steps" in the project's review sites
   (`reports/`, `reports/archive/`, `projects/<name>/reports/`), roadmap/ideas docs
   (`docs/`, `ideas/`, `spec/`), the open steps in the agent memory notes for that project.
3. **Quality and performance with a measurable before/after**: slow launch, heavy screens,
   memory, bundle size, missing tests around fragile code, accessibility gaps (Dynamic Type,
   VoiceOver labels, contrast).
4. **Features** that fit the product's direction (its `CLAUDE.md`, README, site copy) and close a
   gap users would notice.

Skip, and note why in the report's intro: work that needs the owner (Apple portal, secrets,
store listings, paid services), shared Supabase schema changes (too risky to land unreviewed; if
truly essential, follow `supabase/README.md` and say so loudly), anything already in flight
(uncommitted work in the project, an open memory note like "candidate build awaiting picks"),
and anything too big to finish and verify in one pass. Prefer a smaller thing done completely
over a big thing half done. A project with nothing worth building gets no branch: say why.

Write the choice down before building (in your notes for the report): what, the evidence, the
value (who gets what), the runner-up options and why they lost.

## 2. Build it on a local branch

```sh
DIR=$(.claude/skills/heji-build-next/worktree.sh new <project> <slug>)   # → heji-build/<date>-<project>-<slug>
```

The worktree is a fresh checkout of `origin/main` at `../<repo>-heji-build/<project>`. Install
what the project needs there (`npm ci`, `flutter pub get`, `xcodegen`, … per its `CLAUDE.md`).

- Build it properly: the app's real components and patterns, tests for the logic, light and dark,
  Dynamic Type, empty/error states. Match the surrounding code.
- User-facing change in an app with an in-app What's New (Voxbrief, Wee Hours; check others'
  `release.env` for a `release_check`): add the entry on the branch for the version it will
  likely ship as (§6 corrects the number if needed).
- Don't bump versions; `cut_release.sh` does that. (Meowtrix releases `package.json`'s version:
  leave the bump to §6.)
- Commit on the branch as you go, clear messages, ending with the session's attribution lines.

## 3. Verify

Run the project's own checks in the worktree: its tests, lints, type checks, the build for every
platform it ships (iOS + watch, Mac, Worker, web). Then run the change for real, preferring the
attached device (root `CLAUDE.md`, "Testing on devices"). A build that doesn't pass stays out
of the report: fix it, or drop it and note why. Record what you ran and the results; they go in
the report.

## 4. Capture it (real, not mocks)

Every build gets real captures of the branch's app running: **before** (main) and **after** (the
branch) screenshots of what changed, plus a **GIF** of the flow when the value is in motion
(navigation, animation, a fix to an interaction). Performance work gets measured numbers
(before/after, how measured) instead of or beside pictures; a non-visual fix gets a capture of
the repro now behaving (test output, a log, the UI state).

Save into `reports/<slug>/site/media/<project>/` (create the report first, §5 step 1). Use the
project's own screenshot tooling when it has some (grep its `CLAUDE.md`/`scripts/`/`tools/` for
"screenshot": e.g. capture scripts, fastlane snapshot, Playwright screenshot configs).
Otherwise:

| Surface | Screenshot | Recording |
|---|---|---|
| iOS (simulator) | `xcrun simctl io booted screenshot after.png` | `xcrun simctl io booted recordVideo --codec h264 flow.mov` (Ctrl-C / kill -INT to stop) |
| iOS (device) | Xcode › Devices, or the project's tooling | QuickTime (manual): prefer the simulator for recordings and say so in `Captured` |
| Mac app | `screencapture -o -l <windowid> after.png` (window id via `osascript`/`GetWindowID`) | `screencapture -v -V 10 flow.mov` |
| Web / Worker site | Playwright with the cached Chromium (`page.screenshot`) | Playwright `recordVideo` → `.webm` |
| Flutter | simulator commands above, or `flutter screenshot` | simulator `recordVideo` |

Drive the app to the right state with launch arguments, deep links or a UI test rather than by
hand; add a debug-only launch argument on the branch if needed. Then:

```sh
.claude/skills/heji-build-next/to_gif.sh flow.mov reports/<slug>/site/media/<project>/flow.gif   # 420px, 12 fps
START=1 DURATION=8 .claude/skills/heji-build-next/to_gif.sh …     # trim; keep each GIF under ~4 MB
```

Look at every capture before using it (Read the PNG; check a GIF's first frames with
`ffmpeg -i x.gif -vframes 1 x.png`): the right screen, no debug overlays, no personal data, no
secrets. The repo is public and the report gets committed (§6).

Keep the worktree until §6, so the user's notes can be applied on the branch.
Move on to the next project.

## 5. Compose the review (heji-candidate-review)

After every project is done, build the site with the `heji-candidate-review` skill (read its
SKILL.md; §2 scaffold, §4 checks), adapted for finished builds:

1. Scaffold: `.claude/skills/heji-candidate-review/new.sh build-next "Build round <date>"`
   → `reports/<date>-build-next/`. (Create it at the start of §4 for the first project so
   captures have a home.)
2. Replace `site/js/candidates.js` with `.claude/skills/heji-build-next/candidates.example.js`
   (carry over the `key`/`dir`/`repo`/`port`/`title` values `new.sh` wrote, so no `__SLUG__`-style
   placeholder is left) and fill it in: one **group per
   project** with a build, a `keepMain(...)` entry plus the build in each, `frame: "card"` with the
   hero capture, `views` for each before/after/GIF in its own frame (`phone`, `browser`, `card`
   with `size`), and `nextSteps` as in the example (it turns the hand-off into merge
   instructions). Add to `site/css/candidates.css`:
   ```css
   .shot { display: block; width: 100%; height: 100%; background: #111; }
   .keep { display: grid; place-content: center; gap: 6px; height: 100%; text-align: center; font: 600 28px Inter, sans-serif; color: #666; }
   .keep small { font-size: 16px; font-weight: 500; }
   ```
3. Every build candidate must answer, in its fields:
   - **Why and the value** (`concept`): the evidence, why it beat the runners-up, who benefits.
   - **What changed** (`moves`).
   - **How it's implemented** (`spec`: today / proposed / files / risks / verify, plus `design`
     blocks when it's structural or measured; numbers are `basis: "measured"` with a `source`).
   - **Facts**: `Project`, `Kind`, `Effort`, `Branch`, `Commit` (short SHA of the branch head),
     `Base`, `Diff` (`git diff --shortstat main...<branch>`), `Tests`, `Release` (patch for
     fixes/quality, minor for features, with the version it would become), `Captured` (where
     and how, e.g. simulator vs device).
4. The `intro` lists projects with no build and why, in one line each.
5. Run the candidate-review checks (§4 there): serve, screenshot gallery/detail/compare, every
   capture loads (no 404s in the server log), Copy summary names every branch.

Hand over: the serve command and URL, one line per build (project · name · kind · why), and how
to respond: crown 🏆 the builds to merge ("Keep main" to skip a project), notes for anything to
change first, then **Copy summary** and paste it back. Remind them the branches exist only on
this machine, so the paste must come back to an agent in this checkout.

## 6. Merge, clean up, push, release (after the hand-off)

The pasted hand-off lists the branches to merge. Merge exactly those; nothing else.

1. **Check:** on main, clean tree, `git pull --ff-only`; every listed branch exists locally
   (`worktree.sh list`) at the listed commit. If a branch is missing (different machine), stop
   and say so.
2. **Apply notes, then merge.** If the user left notes on a picked build, make those changes on
   its branch (in its worktree), re-run its checks and re-capture if the look changed. Then, one
   at a time:
   ```sh
   git merge --no-ff <branch> -m "<Project>: <what it adds> (heji-build-next)"
   ```
   Conflicts (rare: projects are separate; shared files like `README.md`, workflows, lockfiles):
   resolve keeping both sides' intent, regenerate lockfiles with the tool rather than hand-merging,
   and re-run that project's checks after resolving.
3. **Clean up every build branch**, merged or not: `.claude/skills/heji-build-next/worktree.sh
   cleanup` (removes all `heji-build/*` worktrees and branches), then `worktree.sh list` prints
   nothing.
4. **Commit the review site** as the record: drop captures of builds that weren't merged (the
   ideas stay as text; set their `views` to `[]` and `render` to a "not merged" card), scan the
   rest for anything sensitive or unreleased-but-secret (memory: reports are public), then commit
   `reports/<slug>/` in its own commit. Fix the What's New version on main now if the release
   version differs from what the branch guessed.
5. **Push main** (`git push origin main`), then wait for each merged project's CI on the new head
   (`gh run list --workflow <CI_WORKFLOW from release.env> --commit <sha>`, `gh run watch`). Red
   CI: fix on main with the `heji-fix-ci` approach (a fix that the merge itself caused is in scope
   of the user's approval; anything bigger, ask).
6. **Release each merged project**, one at a time, with the level the hand-off names:
   ```sh
   scripts/cut_release.sh <project> <level> --dry-run
   scripts/cut_release.sh <project> <level> --notes "<what shipped, user-facing>" --watch
   ```
   (Meowtrix: bump `package.json` on main and pass the version, per its `CLAUDE.md`.) After an iOS
   upload, check App Store Connect accepted the build (root `CLAUDE.md`, "Common pitfalls").
7. **Report back**: what merged (commit SHAs), the releases (tags, workflow results, TestFlight
   verdicts), what was dropped, and that every build branch is gone.
