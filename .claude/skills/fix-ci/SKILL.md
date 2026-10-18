---
name: fix-ci
description: Check every CI/CD signal of this HEJI monorepo (GitHub Actions workflows, scheduled and release runs, Cloudflare Workers Builds and other commit checks on main), find what failed recently, investigate the cause, and present a proposal (why it fails + the fix) for approval; only after the user approves, fix it, verify, commit and push. Use when asked to "check CI", "what's failing", "fix the build", "why is the pipeline red", or when cut_release.sh refuses because main is CI-red.
---

# Fix failing CI/CD

The loop: **survey → investigate → propose → (approval) → fix → verify → commit + push → watch.**
Never skip the proposal: nothing is edited, re-run, committed or pushed until the user approves it.

Read the root `CLAUDE.md` first (isolation rules, releases), and the failing project's
`projects/<name>/CLAUDE.md` before touching its code.

## 1. Survey: what is red

Every signal, newest first. The repo is `gh repo view --json nameWithOwner -q .nameWithOwner`.

```sh
gh run list --branch main --limit 60 \
  --json databaseId,workflowName,event,status,conclusion,createdAt,headSha,displayTitle \
  -q '.[] | [.createdAt[:16], .workflowName, .event, .status, (.conclusion // "-"), .headSha[:8], .databaseId] | @tsv'
gh run list --status failure --limit 30 --json workflowName,event,headBranch,createdAt,databaseId   # any branch, incl. tags/releases
gh api "repos/{owner}/{repo}/commits/main/check-runs" -q '.check_runs[] | [.name, .status, (.conclusion // "-"), .app.slug] | @tsv'
gh api "repos/{owner}/{repo}/commits/main/status" -q '.statuses[] | [.context, .state, .target_url] | @tsv'
```

- **GitHub Actions**: `.github/workflows/<project>-*.yml` plus the shared `supabase-ci.yml` and
  `pages.yml`. Events matter: `push`/`pull_request` (CI), `release` (TestFlight, Mac DMGs, server
  tarballs), `schedule` (the weekly Wednesday TestFlight runs), `workflow_dispatch`.
- **Cloudflare Workers Builds** (each project's site + Worker deploys on push to main) and any
  other app report as commit check runs / statuses: the `check-runs` and `status` calls above.
- A workflow counts as **failing now** only if its *latest* run on main (or for the latest
  release tag) failed. An older failure followed by a success is already fixed: mention it, don't
  chase it. A run that failed only because a newer push cancelled it is not a failure.

Summarise as a table: workflow / check · trigger · last result · since when (first failing run
after the last green one: `gh run list --workflow <file> --limit 20`) · commit that broke it.

## 2. Investigate each failure

```sh
gh run view <id> --log-failed | tail -200        # the failing step's output
gh run view <id> --json jobs -q '.jobs[] | [.name, .conclusion] | @tsv'
gh run view <id> --log | grep -n -iE "error|fail|fatal" | head -50
git log --oneline <last-green-sha>..<first-red-sha> -- <paths the workflow watches>
```

Find the root cause, not the symptom. Common classes here:

- **Code/test regressions**: reproduce locally with the project's own command from its
  `CLAUDE.md` (`swift test`, `npm run test:<project>`, `flutter test`, `xcodebuild …`).
- **Isolation checks** (`check_isolation.mjs`, `graduation_check.sh`, `check_supabase.mjs`): a
  reference across projects, a migration touching another schema, a misnamed migration.
- **Spec drift** (Wee Hours `scripts/sync-spec.sh --check`): a `spec/` file edited without syncing.
- **Signing / secrets / Apple** (TestFlight, Mac release, notarization): expired certificates or
  profiles, a missing secret (`gh secret list`), App Store Connect build-number or version
  conflicts. Never let signing mint new certificates; never print secret values.
- **Toolchain drift** on hosted runners (Xcode, Flutter, Node, Rust versions): compare the
  runner image in the log with the last green run.
- **Flaky / infrastructure** (network, runner outage, rate limits): confirm by the log, and by
  re-running only after approval.

Read code and logs; don't edit anything yet.

## 3. Propose (stop here and wait)

For each failing signal give: what fails (workflow, job, step, link), **why** (the root cause with
the log lines and the commit that introduced it), **the proposed fix** (files and the change, or
"re-run" for a confirmed flake, or a manual step only the user can do, such as renewing a
certificate or adding a secret), how you'll **verify** it locally, and the risk. Group related
failures; order by impact (release and deploy pipelines first). Then ask for approval, per item
when there are several. Do not change anything before the answer.

## 4. Fix, verify, commit, push (after approval)

1. Make only the approved changes, following the project's `CLAUDE.md` and the repo rules
   (self-contained projects, no cross-project references, schema changes through
   `scripts/db_migration.sh`).
2. Verify locally with the same commands the workflow runs (read the workflow's `run:` steps).
   Say plainly what you could not run locally (signing, hosted secrets).
3. Commit on `main` (the repo's CI and releases run from main; branch first only if the user asks
   for a PR), one commit per fix, message naming the workflow it fixes, then `git push`.
4. Watch the re-triggered runs: `gh run list --branch main --limit 10`, `gh run watch <id>
   --exit-status`. For workflows that only run on `release` or `schedule`, re-run the failed run
   (`gh run rerun <id> --failed`) only if the fix applies to that run's commit, otherwise use
   `workflow_dispatch` when the workflow has it, or say what will exercise it next.
5. Report each signal's final state with the run links. If something is still red, go back to 2
   and propose again; don't push speculative fixes.

Never cut a release from this skill (`scripts/cut_release.sh` is its own step), never force-push,
and never disable a check or mark a test skipped to make it green without saying so in the
proposal and getting approval for exactly that.
