---
name: triage-feedback
description: Fetches pending in-app "shake to report" feedback (screenshot + boxed region + description + device/app state) from Firestore and turns each report into a scoped implementation plan (or a direct fix). Use when the user asks to triage feedback, check for bug reports, or process user-submitted issues for Contempo.
---

# Triage in-app feedback

Contempo's apps let a signed-in user shake their device to capture a
screenshot, box the area of interest, and attach a short description. Reports
land in Firestore at `users/{uid}/appFeedback/{feedbackId}` (a collection
group — no single top-level collection, since each report is nested under
its owner). This skill turns those reports into implementation plans without
the user having to describe the bug by hand.

## 1. Fetch pending reports

Run the fetch script — it handles the collection-group query, resolves each
screenshot from Storage to a local file, and prints one JSON manifest:

```bash
cd backend/scripts
npm install   # first run only
node fetch-feedback.js                     # status=pending, limit=20 by default
node fetch-feedback.js --status pending --limit 5
```

**Auth**: the script uses Application Default Credentials. If it fails with
an auth error, the user needs to run `gcloud auth application-default login`
once (interactive, needs a browser) — their own account already has Owner on
`contempo-str`, no separate service account is required. Don't try to
work around an auth failure yourself; tell the user what to run.

If the manifest is an empty array, report that and stop — nothing to triage.

## 2. Read each report

For each manifest entry (`feedbackId`, `uid`, `docPath`, `screenshotLocalPath`,
`description`, `region`, `environment`, `createdAt`):

1. `Read` the screenshot at `screenshotLocalPath` (it's an image — the Read
   tool renders it directly).
2. If `region` is non-null, it's a `{x, y, w, h}` box in 0..1 fractions of
   the image — mentally crop to that region; it's the user's pointer at what
   matters, the rest of the screenshot is just context.
3. Read `description` (what the user typed) and `environment.screenName` —
   this should match one of the app's screen/folder identifiers (`Capture`,
   `Dashboard`, `Chat`, `Confirm`, `EntryDetail`, `Settings`, ...).

## 3. Ground it in the actual source

Don't plan from the screenshot alone — find the real code for that screen
before proposing anything:

- Android: `android/app/src/main/java/com/hejitech/contempo/ui/<screenName lowercased>/`
- iOS: `ios/Contempo/Sources/App/<ScreenName>/`

Both platforms ship in parity (see `CLAUDE.md`) — a UI bug reported from one
platform's screenshot usually needs the equivalent fix on the other platform
too, so open both screen's source before concluding scope.

## 4. Produce the plan (or the fix)

Default to writing a short, concrete plan per report: what's wrong (tie it
to the boxed region + description), which file(s)/line(s) need to change on
each platform, and the smallest change that fixes it — same bar as any other
task in this repo (no speculative refactors, no unrequested abstractions).

If the user's invocation says to actually implement the fixes (not just
plan), do so following this repo's normal conventions (`CLAUDE.md`), then
run the production build verification (`./scripts/install-android-prod.sh`,
`./scripts/install-ios-prod.sh --no-launch`) before considering it done.

## 5. Mark it triaged

Once a report has a plan (or a fix) in hand, mark it so it doesn't get
re-triaged next run:

```bash
node backend/scripts/fetch-feedback.js --mark-triaged users/<uid>/appFeedback/<feedbackId>
```

Use the exact `docPath` from that report's manifest entry. If a fix actually
shipped (not just planned), use `--mark-resolved` instead of `--mark-triaged`.

## Notes for running this unattended

This skill is meant to eventually run on a schedule with no one watching —
keep that in mind: don't ask clarifying questions mid-run, don't skip the
`--mark-triaged`/`--mark-resolved` step (an unmarked report gets reprocessed
forever), and don't fabricate an `environment.screenName` match if the real
one isn't obviously one of the known screen folders — say so in the plan
instead of guessing.
