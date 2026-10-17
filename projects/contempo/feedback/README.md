# Feedback

A standalone, login-free feedback form, served by the Contempo Worker at
`https://contempo.hejitech.workers.dev/feedback/` (copied into the Worker's assets by
`npm run assemble -w @contempo/web`). It's also the contact address the privacy policy and terms
point to. Zero-dependency static site: no install, no build step, no keys on the page.

`public/assets/script.js` posts `{ message, email }` to `POST /api/feedback` (same origin). The
Worker (`services/web/src/worker/index.ts`, `publicFeedback`) forwards it to Contempo's FeedbackKit
project as a text-only report, with the email as the reporter, so it shows up next to the apps'
shake-to-report reports. Nothing is stored in Contempo's own database.

## Local dev

```bash
./scripts/serve-feedback.sh          # http://localhost:8440 — styling only; submitting needs the Worker
npm run dev:worker -w @contempo/web  # from the repo root: the whole Worker, form at /feedback/
```
