---
name: heji-archive-reports
description: Tidy the repo-root reports/ folder by moving finished review sites into reports/archive/<slug>/, keeping every archived report working (its serve.sh, pages, assets, saved hearts/ratings), rewriting every reports/<slug> path that mentions it (other reports, repo files, Claude memory), restarting its server if one was running, and verifying each moved report by serving it and fetching every file its pages reference. Also restores an archived report. Use when the user asks to "archive reports", "clean up reports/", "move old reports", "tidy the review sites", or to bring an archived report back.
---

# Archive reports

`reports/` (repo root) holds review sites, one folder per report: usually `site/` (served root)
and `script/serve.sh` (finds `../site` relative to itself, fixed port). Only the reports still in
review belong directly under `reports/`; finished ones go to `reports/archive/<slug>/`, where they
must keep working exactly as before. Reports are committed (the repo is **public**).

Scope: only the repo-root `reports/`. Never touch `projects/<name>/reports/` (e.g. Contempo's,
Meowtrix's): app code and docs reference those by path.

Everything goes through the script:

```sh
S=.claude/skills/heji-archive-reports/reports.py
$S                              # list active and archived reports, least recently changed first
$S archive <slug> [<slug>...]   # move to reports/archive/<slug>, then verify
$S archive --older-than 7       # every active report unchanged for 7+ days
$S restore <slug>               # back to reports/<slug>, then verify
$S check [<slug>...]            # verify only (default: every report, active and archived)
```

## 1. Choose what to archive

Run `$S` and use what the user said: named reports, "older than N days", or "everything but the
current ones". If they only said "archive reports", propose the list (oldest first, plus any that
memory or the conversation says are finished) and archive after they pick. Never archive a report
that memory or the conversation says is still awaiting the user's decisions without asking.

## 2. Move

`$S archive …` does, per report:

1. **Refuses** if the move would break it: a link that leaves the report folder (`../../…`), an
   absolute local path (`file://`, the repo's absolute path) or a symlink out of the report. Fix
   those to relative paths inside the report first, then rerun.
2. Stops any server serving the old folder (`python3 -m http.server` / `http-server`).
3. Moves the folder (plain `mv`; nothing is staged).
4. Rewrites `reports/<slug>` → `reports/archive/<slug>` everywhere it's written as a path: every
   report (its own `serve.sh` usage lines, the `dir:` that goes into the pasted review summary,
   other reports' "copied from" notes), tracked repo files and this repo's Claude memory
   (`~/.claude/projects/<repo path>/memory/*.md`). It doesn't touch `projects/*/reports/…`.
5. Restarts the stopped server on its old port (same port = the browser keeps the review's
   hearts, ratings and notes, which live in `localStorage` per port).
6. **Verifies**: serves the moved report on a free port through its own `serve.sh` (or plain
   `http.server` if it has none), fetches `/` and every local file its HTML and CSS reference,
   and fails on anything but HTTP 200.

Ports stay reserved after archiving: `heji-candidate-review/new.sh` skips ports and slugs used in
`reports/archive/` too, so a new review never inherits an archived one's saved state.

## 3. Check, then commit

1. `$S check` must end with every report `ok`. If one is `BAD`, fix it (or `restore` it) before
   going on.
2. Open one moved report in the browser if the user wants to see it (`reports/archive/<slug>/script/serve.sh`).
3. Commit the move with the path updates (`git add -A reports` plus any repo files the script
   listed); git records the moves as renames. Push only when the user asks.

Memory files the script rewrote are outside the repo: mention them, don't commit them.

## Adding new reports

Before committing a new report (or anything added under `reports/`), scan it for anything that
shouldn't be public: credentials and signed URLs with live tokens, real people's names, emails
other than `@example.com`, family details, private hostnames/IPs, and unreleased business plans
the user hasn't agreed to publish. Mock data uses invented names.
