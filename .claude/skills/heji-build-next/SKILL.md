---
name: heji-build-next
description: Go through every project in this HEJI monorepo, find the most valuable things to build for each (features, quality/performance improvements, bug fixes), grounded only in the current code and in what's new outside (web search: new platform APIs, library and model releases, what users ask for), never in internal reports or past reviews, and propose several per project in a heji-candidate-review site; after the user picks, build the picks autonomously on local-only feature branches (never pushed), capture them running (real screenshots, screen recordings turned into GIFs) and present the finished builds in a second review site where the user picks what to merge. When that hand-off comes back, merge the picked branches into main, delete every build branch, push and release the projects that changed. The user can set how many proposals per project (default 3) and which projects. Use when asked to "build the next thing for every project", "find and build what's most valuable", "do a build round", "propose what to build next", "autonomous improvements across the repo", or invoked as /heji-build-next; also when a pasted hand-off says it is a heji-build-next proposal or build review.
---

# Build the next thing, for every project

The loop: **scan every project → propose N options each → proposal review → user picks →
build the picks on local branches → verify → capture → build review → user picks → merge picks →
delete all build branches → push main → release what changed.**

Three phases, each ending with a hand-off the user pastes back (possibly into a new session):

- **Phase A, propose (§0–§2).** Read-only: scan, propose, present. Nothing is built. Stops at the
  proposal review.
- **Phase B, build (§3–§7)** starts when the user pastes the *proposal* hand-off. The paste is
  the approval to build exactly what it picked. Runs autonomously: don't stop between projects;
  ask only if something blocks the whole run. Stops at the build review.
- **Phase C, merge and release (§8)** starts when the user pastes the *build* hand-off. The paste
  is the approval to merge, push and release exactly what it lists, nothing else.

Tell which phase a paste belongs to by its "What to do next" section (each site's `nextSteps`
names its phase).

**Arguments** (from the invocation, e.g. `/heji-build-next 2 per project, only weehours and
voxbrief`): proposals per project (default **3**; per-project counts allowed, e.g. "5 for Wee
Hours"), which projects (default all of `projects/*`), and anything to focus on ("bugs only",
"performance"). Fewer good proposals beat padding: if a project has fewer worthwhile options than
asked, propose what there is and say why.

Hard rules for the whole skill:

- **A build branch never leaves this machine.** Never `git push` a `heji-build/*` branch, never
  open a PR from one, never set an upstream. `worktree.sh` installs a pre-push hook that refuses
  them; don't remove or bypass it. Only main is pushed, in §8.
- **Main stays untouched until §8.** All code goes into the per-project worktrees. The only things
  written in the main checkout are the review sites in `reports/` and the ledgers
  (`projects/<name>/build-next.md`), left uncommitted until §8. Build branches never touch a
  ledger.
- **Respect each project.** Read root `CLAUDE.md` and `projects/<name>/CLAUDE.md` before
  touching a project; follow its commands, conventions, What's New rules and isolation rules
  (`supabase/GRADUATION.md`). One project's branch touches only `projects/<name>/` (plus its own
  `.github/workflows/<name>-*.yml` if the build truly needs it).
- **The repo is public, and so are the review sites once committed.** No personal data (the
  user's own FeedbackKit screenshots can show family names), no secrets, and no working details of
  a security problem that isn't merged and fixed.

## The ledger: what was already proposed and decided

Each project keeps `projects/<name>/build-next.md`, a tracked file the skill reads before
proposing and appends to after each decision, so a declined idea doesn't come back every round.
It lives in the project (not in agent memory, which is local to one machine; not at the root, so
it moves with the project when it graduates). Create it on first use:

```markdown
# Build-next ledger

Ideas heji-build-next proposed for this project and what the owner decided. The skill reads this
before proposing (see .claude/skills/heji-build-next/SKILL.md, "The ledger"). Newest first.

| Date | Idea | Outcome | Evidence | Why / owner's note | Revisit if |
|---|---|---|---|---|---|
| 2026-10-28 | On-device summaries with the new Foundation Models API | kept main after build | NoteSummarizer.swift:42 uses the bundled model; https://developer.apple.com/… | – | the bundled model is dropped |
```

- **Idea**: the proposal's name. **Evidence**: what identifies it (the gap at `file:line`, the
  outside source's URL), so a reworded version of the same idea is still recognised.
- **Outcome**, and what it means for the next scan:
  - `merged in <version>`: done; don't propose it again (a follow-up gets its own name).
  - `kept main after build`: built, then the owner kept main. Rejected.
  - `skipped`: the owner crowned "Skip" for the project, or declined it in a note. Rejected.
  - `not picked`: proposed while the owner chose something else. It may come back, marked as a
    repeat; the second time it goes unpicked it becomes `not picked twice`, which counts as
    rejected.
- A rejected idea comes back only when its **Revisit if** condition is met or there's new
  evidence (a new library release, a new platform API, a new measurement), and then the proposal
  says so.
- **Why / owner's note**: the owner's note, verbatim, when there is one.
- Public repo: an unmerged security idea is recorded as "security hardening (details withheld)",
  with no evidence column.

## Phase A: propose

### 0. Preflight

```sh
git status --porcelain            # must be empty; if not, stop and ask (don't stash the user's work)
git switch main && git pull --ff-only
.claude/skills/heji-build-next/worktree.sh list   # leftover heji-build branches from an earlier run?
```

Leftover build branches mean an earlier round wasn't merged or cleaned up: ask whether to drop
them (`worktree.sh cleanup`) before starting. Note the date: branches and the reports use it.

### 1. Find candidates (per project)

New ideas come from **two sources only: the current implementation and the outside world.**
Internal records are never a source: FeedbackKit reports, GitHub issues, review sites in
`reports/` (active or archived) and `projects/<name>/reports/`, roadmap/ideas/decision docs, the
agent memory notes, past build rounds. Whatever is in them is already known to the owner (and
often already fixed while still looking open), so proposing it adds nothing new. Use them only
afterwards, to drop duplicates (below). Bug reports and failing CI have their own channels
(FeedbackKit's fix loop, `heji-fix-ci`).

Go through the chosen projects in order (`ls projects`). For each:

1. **Read what exists today.** The project's `CLAUDE.md`, then the code: its screens, services,
   data model, dependencies (`Package.swift`/`project.yml`, `package.json`, `pubspec.yaml`,
   Gradle catalogs and their versions), the models it bundles, what's on its live site. Know what
   the app does before thinking about what it should do next.
2. **Look outward (web search, release notes, docs).** What changed since this was built that the
   app could use or users now expect:
   - new platform capabilities (this year's iOS/watchOS/macOS/Android APIs, Apple Intelligence /
     Foundation Models, App Intents, Live Activities, widgets, Web platform features);
   - new releases of the libraries and models the project already depends on (changelogs of its
     pinned versions vs the latest: new features, performance, fixes it would gain);
   - better or smaller models for what it does on device (ASR, LLMs, vision), with published
     numbers;
   - what users of this kind of app ask for publicly (App Store reviews of comparable apps,
     forums, Reddit, competitors' release notes) that this project could supply.
   Cite the URL for every outside fact.
3. **Audit the current implementation** for what a user would notice: measured performance
   (launch, bundle size, memory), accessibility (VoiceOver, Dynamic Type, contrast), correctness
   in paths only a real device or real data exercises, security. Ground it in `file:line` on
   main, and reproduce it before proposing when that's cheap (a test, a script, the device).
4. **Drop what's already known or built.** Before keeping an idea, check it isn't already in
   the code (search for it), in the project's What's New / changelog, in `git log`, in the
   ledger, or in the internal records above. If it is, it's not new: drop it, don't propose it
   with a "status" twist. Every kept idea must point at today's code showing the gap
   (`spec.today` with `file:line`) and, if it comes from outside, at its source URL.
5. Rank what's left by value to users over effort and keep the top N.

Leave out, and list in the intro with the reason: work that needs the owner (Apple portal,
secrets, store listings, paid services), shared Supabase schema changes (too risky to land
unreviewed; if truly essential, say so loudly), anything already in flight (uncommitted work in
the project), and anything too big to finish and verify in one pass. Prefer smaller things done
completely over big things half done.

### 2. The proposal review (heji-candidate-review)

Build the site with the `heji-candidate-review` skill (read its SKILL.md; §2 scaffold, §4 checks):

1. Scaffold: `.claude/skills/heji-candidate-review/new.sh build-next-proposals "Build proposals
   <date>"` → `reports/<date>-build-next-proposals/`.
2. Replace `site/js/candidates.js` with `.claude/skills/heji-build-next/proposals.example.js`
   (carry over the `key`/`dir`/`repo`/`port`/`title` values `new.sh` wrote) and fill it in: one
   **group per project**, a `skip(...)` entry plus the N proposals in each. Add the CSS from
   §6 step 2 below to `site/css/candidates.css`.
3. Every proposal answers, in its fields:
   - **Why and the value** (`concept`): the source (the gap at `file:line` on main, a measured
     number, a reproduction, or the outside source's URL), who benefits, and whether it was
     reproduced.
   - **What would change** (`moves`), and **how it would be built** (`spec`: today / proposed /
     files / risks / verify-plan).
   - **Facts**: `Project`, `Kind` (Bug fix, Quality, Performance, Feature, Security), `Effort`
     (S/M/L), `Evidence` (one line), `Release` (patch for fixes/quality, minor for features),
     `Captures` (what the build review would show: device/simulator, before/after, GIF, numbers).
   - **Render**: a real capture of today's gap when there is one (a screenshot of the current
     app, a measured chart), otherwise
     the text card the example's `idea(...)` helper draws.
4. `intro`: how to respond (below), projects with nothing worth proposing and why, and per project
   the earlier ideas the ledger kept out ("Wee Hours: 2 earlier ideas left out, see
   projects/weehours/build-next.md"), so the owner can revive one by saying so. A proposal that
   was `not picked` before says so in its facts (`Proposed before: 2026-10-21, not picked`).
5. Run the candidate-review checks (§4 there).

Hand over: the serve command and URL, one line per proposal (project · name · kind · evidence),
and how to respond: per project crown 🏆 the proposal to build, ♥ any others to build as well
(each becomes its own branch), crown "Skip" to build nothing there, notes for anything to change
in the plan, then **Copy summary** and paste it back. Then stop: nothing is built until the paste.

## Phase B: build

The pasted proposal hand-off lists, per project, the 🏆 winner and any ♥ shortlisted proposals:
build all of those, nothing else. The user's notes override the proposal's text. Projects with
"Skip" (or no pick) get nothing.

First, record the decisions in each proposed project's ledger (in the main checkout, uncommitted
until §8): every proposal not built gets a line, `skipped` (the project's "Skip" was crowned, or
a note declines it) or `not picked` (`not picked twice` when the ledger already has it as `not
picked`), with the owner's note verbatim. Picked proposals are recorded in §8, once their fate is
known. If nothing at all was picked, commit the ledgers and the proposal review now (one commit,
pushed) and stop: there's no phase C.

### 3. Build each pick on a local branch

```sh
DIR=$(.claude/skills/heji-build-next/worktree.sh new <project> <slug>)   # → heji-build/<date>-<project>-<slug>
```

The worktree is a fresh checkout of `origin/main` at `../<repo>-heji-build/<project>-<slug>`
(one per pick, so two picks in one project are independent branches). Install what the project needs there (`npm ci`,
`flutter pub get`, `xcodegen`, … per its `CLAUDE.md`), and copy the git-ignored files it needs
(models, `local.properties`, `.dev.vars`) from the main checkout with `cp -c` (clones, no extra
disk). Put build output (`-derivedDataPath`, venvs, caches) under the worktree area on the data
volume, not the system disk.

- Build it properly: the app's real components and patterns, tests for the logic, light and dark,
  Dynamic Type, empty/error states. Match the surrounding code.
- User-facing change in an app with an in-app What's New (Voxbrief, Wee Hours, Meowtrix; check
  others' `release.env` for a `release_check`): add the entry on the branch for the version it
  will likely ship as (§8 corrects the number if needed).
- Don't bump versions; `cut_release.sh` does that. (Meowtrix releases `package.json`'s version:
  leave the bump to §8.)
- Commit on the branch as you go, clear messages, ending with the session's attribution lines.

### 4. Verify

Run the project's own checks in the worktree: its tests, lints, type checks, the build for every
platform it ships (iOS + watch, Mac, Worker, web). Then run the change for real, preferring the
attached device (root `CLAUDE.md`, "Testing on devices"). A build that doesn't pass stays out
of the review: fix it, or drop it and note why. Record what you ran and the results; they go in
the review.

### 5. Capture it (real, not mocks)

Every build gets real captures of the branch's app running: **before** (main) and **after** (the
branch) screenshots of what changed, plus a **GIF** of the flow when the value is in motion
(navigation, animation, a fix to an interaction). Performance work gets measured numbers
(before/after, how measured) instead of or beside pictures; a non-visual fix gets a capture of
the repro now behaving (test output, a log, the UI state).

Save into `reports/<date>-build-next/site/media/<project>/` (create the build review first, §6
step 1). Use the project's own screenshot tooling when it has some (grep its
`CLAUDE.md`/`scripts/`/`tools/` for "screenshot"). Otherwise:

| Surface | Screenshot | Recording |
|---|---|---|
| iOS (simulator) | `xcrun simctl io <udid> screenshot after.png` | `xcrun simctl io <udid> recordVideo --codec h264 flow.mov` (Ctrl-C / kill -INT to stop) |
| iOS (device) | `xcrun devicectl device capture screenshot`, or pull a file the app wrote: `devicectl device copy from --domain-type appDataContainer` | QuickTime (manual): prefer the simulator for recordings and say so in `Captured` |
| Mac app | `screencapture -o -l <windowid> after.png` (window id via `osascript`/`GetWindowID`) | `screencapture -v -V 10 flow.mov` |
| Web / Worker site | Playwright with the cached Chromium (`page.screenshot`) | Playwright `recordVideo` → `.webm` |
| Flutter | simulator commands above, or `flutter screenshot` | simulator `recordVideo` |

Drive the app to the right state with launch arguments, deep links or a UI test rather than by
hand. When a capture needs a temporary harness (a launch argument that triggers the flow), keep
it out of the commit, and **rebuild and re-run the tests after removing it**: a harness removed
by script can take a brace with it. For "before", run the same harness on a temporary detached
worktree of main and remove that worktree afterwards. Then:

```sh
.claude/skills/heji-build-next/to_gif.sh flow.mov reports/<slug>/site/media/<project>/flow.gif   # 420px, 12 fps
START=1 DURATION=8 .claude/skills/heji-build-next/to_gif.sh …     # trim; keep each GIF under ~4 MB
```

Look at every capture before using it (Read the PNG; check a GIF's first frames with
`ffmpeg -i x.gif -vframes 1 x.png`): the right screen, no debug overlays, no personal data (shell
prompts show the account and host name; simulators and demo accounts should use demo names), no
secrets.

Keep the worktrees until §8, so the user's notes can be applied on the branches.
Move on to the next pick.

### 6. The build review (heji-candidate-review)

After every pick is built, build the second site:

1. Scaffold: `.claude/skills/heji-candidate-review/new.sh build-next "Build round <date>"`
   → `reports/<date>-build-next/`. (Create it at the start of §5 for the first build so captures
   have a home.)
2. Replace `site/js/candidates.js` with `.claude/skills/heji-build-next/candidates.example.js`
   (carry over the `key`/`dir`/`repo`/`port`/`title` values `new.sh` wrote, so no `__SLUG__`-style
   placeholder is left) and fill it in: one **group per project** with a build, a `keepMain(...)`
   entry plus the build(s) in each, `frame: "card"` with the hero capture, `views` for each
   before/after/GIF in its own frame (`phone`, `browser`, `card` with `size`), and `nextSteps` as
   in the example (it turns the hand-off into merge instructions). Add to
   `site/css/candidates.css`:
   ```css
   .shot { display: block; width: 100%; height: 100%; background: #111; }
   .keep { display: grid; place-content: center; gap: 6px; height: 100%; text-align: center; font: 600 28px Inter, sans-serif; color: #666; }
   .keep small { font-size: 16px; font-weight: 500; }
   .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; height: 100%; padding: 14px; box-sizing: border-box; background: #15171b; }
   .pair figure { margin: 0; display: grid; grid-template-rows: 1fr auto; gap: 8px; min-height: 0; }
   .pair img { width: 100%; height: 100%; object-fit: contain; min-height: 0; }
   .pair figcaption { font: 600 15px Inter, sans-serif; color: #d6d9df; text-align: center; }
   ```
   Two builds in one project: the user crowns one and ♥s the other to merge both (say so in the
   intro); `nextSteps` merges every 🏆, and §8 also merges ♥ builds the hand-off lists.
3. Every build candidate must answer, in its fields:
   - **Why and the value** (`concept`): the evidence, who benefits; mention the proposal it came
     from and anything that changed from the plan.
   - **What changed** (`moves`).
   - **How it's implemented** (`spec`: today / proposed / files / risks / verify, plus `design`
     blocks when it's structural or measured; numbers are `basis: "measured"` with a `source`).
   - **Facts**: `Project`, `Kind`, `Effort`, `Branch`, `Commit` (short SHA of the branch head),
     `Base`, `Diff` (`git diff --shortstat main...<branch>`), `Tests`, `Release` (patch for
     fixes/quality, minor for features, with the version it would become), `Captured` (where
     and how, e.g. simulator vs device).
4. The `intro` lists picks that couldn't be built and why, in one line each, and anything found
   along the way that needs the owner.
5. Run the candidate-review checks (§4 there): serve, screenshot gallery/detail/compare, every
   capture loads (no 404s in the server log), Copy summary names every branch.

### 7. Hand over

The serve command and URL, one line per build (project · name · kind · why), and how to respond:
crown 🏆 the builds to merge ("Keep main" to skip a project), notes for anything to change first,
then **Copy summary** and paste it back. Remind them the branches exist only on this machine, so
the paste must come back to an agent in this checkout. Then stop.

## Phase C: merge and release

### 8. Merge, clean up, push, release (after the build hand-off)

The pasted hand-off lists the branches to merge. Merge exactly those; nothing else.

1. **Check:** on main, clean tree (the uncommitted review sites and ledgers are expected), `git pull
   --ff-only`; every listed branch exists locally (`worktree.sh list`) at the listed commit. If a
   branch is missing (different machine), stop and say so.
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
   nothing. Remove the build caches you put in the worktree area (literal paths).
4. **Update the ledgers**: each built proposal gets a line, `merged in <version it will ship as>`
   or `kept main after build` (with the owner's note), next to the phase-B lines already there.
5. **Commit the review sites and ledgers** as the record (the proposal review and the build review): drop
   captures of builds that weren't merged (the ideas stay as text; set their `views` to `[]` and
   `render` to a "not merged" card), reduce unmerged security findings to one line with no
   details, scan the rest for anything personal, secret or unreleased-but-secret, then commit
   `reports/<date>-build-next*/` and the `projects/*/build-next.md` ledgers in their own commit. Fix the What's New version on main now if the
   release version differs from what the branch guessed.
6. **Push main** (`git push origin main`), then wait for each merged project's CI on the new head
   (`gh run list --workflow <CI_WORKFLOW from release.env> --commit <sha>`, `gh run watch`). Red
   CI: fix on main with the `heji-fix-ci` approach (a fix that the merge itself caused is in scope
   of the user's approval; anything bigger, ask).
7. **Release each merged project**, one at a time, with the level the hand-off names:
   ```sh
   scripts/cut_release.sh <project> <level> --dry-run
   scripts/cut_release.sh <project> <level> --notes "<what shipped, user-facing>"
   ```
   (Meowtrix: bump `package.json` on main and pass the version, per its `CLAUDE.md`.) Releasing
   several back to back, watch each release's own run (display title = the release) rather than
   relying on `--watch`, which can follow another release's skipped run. After an iOS upload,
   check App Store Connect accepted the build (root `CLAUDE.md`, "Common pitfalls"). Web changes
   for Contempo and FeedbackKit: check the live site and deploy by hand if Workers Builds didn't.
8. **Report back**: what merged (commit SHAs), the releases (tags, workflow results, TestFlight
   verdicts), what was dropped, and that every build branch is gone.
