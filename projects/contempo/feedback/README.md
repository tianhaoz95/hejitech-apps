# Feedback

A standalone, login-free feedback form, hosted separately from the main
Contempo app and web dashboard. Zero-dependency static site — no install, no
build step — same philosophy as `reports/` and `branding/landing_v0/site/`.

Firestore access uses the Firebase modular SDK loaded straight from the
`gstatic.com` CDN as ES modules (see `public/assets/script.js`), so there's
nothing to `npm install`.

It's wired to its own Firebase Web App registration ("Contempo Feedback",
separate from "Contempo Web" — see `public/assets/firebase-config.js`),
though it lives in the same `contempo-str` project and writes to a
top-level `feedback` collection (public create-only — see
`backend/firestore.rules`). Not a secret; see that file's comment. Regenerate
it via:

```bash
npx -y firebase-tools@latest apps:sdkconfig WEB 1:664765495548:web:c3b24b46ce90169cac3307 --project contempo-str
```

Hosted at the `contempo-feedback` Firebase Hosting site
(`https://contempo.hejitech.workers.dev/feedback/`), deployed automatically by
`.github/workflows/firebase-deploy.yml`'s `deploy-feedback` job whenever
`feedback/**` changes on `main`.

## Local dev

```bash
# Quick visual/style check only — no Firestore writes will actually persist
# unless the emulator suite is also running (script.js still routes to the
# emulator on localhost, it just won't be listening).
./scripts/serve-feedback.sh          # http://localhost:8440

# Full loop: Firebase emulators + this site together, torn down together on
# Ctrl+C. Submissions land in the emulator's `feedback` collection — check
# the Emulator UI at http://localhost:4000.
#
# Defaults to project "contempo-str", NOT the usual "demo-contempo" —
# see the script's own comment: firebase-config.js is a committed, zero-build
# file that always hardcodes projectId: "contempo-str", so the emulator
# suite has to be started with that same id for the site's writes to land
# somewhere this script can show you. Still fully local/offline regardless.
./scripts/run-feedback-with-emulators.sh
```
