---
name: heji-review-account
description: Give a HEJI project's iOS app an App Review demo account without offering email sign-in to people -- a Worker endpoint (POST /api/review-sign-in) that checks the project's own secrets, resets one account to demo data and mints a normal Supabase session; a small "Sign in with email" entry in the app (no sign-up, no reset); production setup with scripts/review_account.sh (password kept in ~/Credentials, Worker secrets, live check, App Store Connect's App Review Information written by API); plus the account-deletion check App Review also makes. Use when asked to "add a review account", "demo account for App Review", "test account for Apple reviewers", "reviewer login", "App Store review sign-in", when an iOS app with sign-in nears its first submission, or from heji-new-project / heji-migrate-project.
---

# App Review demo account

App Review needs to sign in. Our apps offer only Sign in with Apple and Google, and the shared
Supabase project has its **Email provider off** (`GET /auth/v1/settings` → `"email": false`), so a
password account can't sign in through Supabase, and nobody should be able to sign up with email.
This skill adds a sign-in path that only the project's own demo account can use, and wires it into
App Store Connect. Headway is the reference (FitLoop the second: a demo plan from core): `projects/headway/services/web/src/worker/review.ts`,
`apps/ios/App/Sources/SignInView.swift` (`EmailSignInSheet`), `review.env`, the
"review sign-in" step of `scripts/test-api.mjs`.

## Who needs it

An iOS app on the App Store that **requires signing in** and has a backend. Skip `BACKEND=none`
apps (Voxbrief, Meowtrix, ToddlerCam, TinyTouch) and apps you can use without an account. An app
whose only sign-in is Sign in with Apple may pass with a review note alone, but reviewers get an
empty account: if the app shows little until set up (FitLoop has no plan until an agent writes
one), it needs this anyway.

Where the projects stand (2026-10-29):

| Project | Status |
|---|---|
| Headway | done: demo commute; App Store Connect 1.0 filled |
| FitLoop | done: core's `demoPlan` from the Monday before; App Store Connect 1.0 filled |
| Contempo | done: two properties, five entries; Worker deploys by hand (`npm run deploy -w @contempo/web`); App Store Connect 1.0 filled. Sign in with Apple added 2026-10-29 (guideline 4.8). |
| Waypack | done (owner decision #71, 2026-10-29): Pro on every sign-in; trips kept between sign-ins (the example trip is a whole bundle), seeded once with `seed-dev.mjs <email> --review <password>` |
| Tether | not needed: works fully offline; sign-in (Apple) only adds sync |
| Wee Hours | not needed: "Use without an account"; Sign in with Apple for partner sync |
| FeedbackKit Portal | not needed: TestFlight only, GitHub sign-in on its own backend, and a manual token sign-in |
| G2 Digest, Polymath | no iOS app |

## How it works

```
app "Sign in with email" ──POST /api/review-sign-in {email,password}──▶ project Worker
   Worker: email == REVIEW_EMAIL and sha256(password) == REVIEW_PASSWORD_SHA256 (secrets)?
           no  → 401 (10 failures / 10 min / IP → 429)        no secrets → 404
           yes → admin/generate_link {type: magiclink}  (creates the user on first use)
                 reset(userId): delete the project's rows, seed demo data
                 /auth/v1/verify {type: magiclink, token_hash}  → Supabase session
   ◀── { access_token, refresh_token, expires_in, user }  (same shape as /auth/v1/token)
```

- Nothing is emailed and it works with the Email provider off (verified against the hosted project
  2026-10-29). Don't use `grant_type=password`: it fails in production.
- The session is an ordinary Supabase session: RLS, the Worker's `/auth/v1/user` check and token
  refresh all work unchanged.
- **Every review sign-in resets the account** to the demo state: no cleanup before a submission, and
  whatever a reviewer did last time is gone. The reset only touches the project's own tables.
- One account **per project** (`appreview+<project>@hejitech.com`; nothing is ever sent to it). It
  lives in the shared user pool, but only that project's secrets know it, which keeps projects
  apart (`supabase/GRADUATION.md`).

## Steps for a project

1. **Worker module.** Copy `.claude/skills/heji-review-account/review.ts` to the Worker
   (`services/web/src/worker/review.ts` or wherever the API lives). It needs a KV binding for the
   throttle (rename `OAUTH_KV` to the project's) and the Supabase URL, anon key and service key it
   already has. If the project already has `sha256`, import it instead of the local copy. Add
   `REVIEW_EMAIL?` / `REVIEW_PASSWORD_SHA256?` to the Worker's `Env`.
2. **Route + reset.** Before the auth check (it's a public route):
   ```ts
   if (path === "/api/review-sign-in" && req.method === "POST") {
     const r = await reviewSignIn(env, req, async (userId) => {
       for (const t of USER_TABLES) await db.from(t).delete().eq("user_id", userId);
       // seed: what a reviewer should see on first open (a commute, a plan, a sample item…)
     });
     return reply(r.body, r.status);
   }
   ```
   Keep `USER_TABLES` as the one list of the user's tables, shared with the delete-my-data route.
   Seed through the project's own store functions and core defaults (core's `normalize…`), so
   the demo data is valid by construction. Seed enough for every screen to show something.
3. **Local values.** In the Worker's local `vars` (wrangler.jsonc, top level only, never the
   production env): `REVIEW_EMAIL: "review@example.com"` and the SHA-256 of a dev password
   (`printf '%s' <project>-review-dev | shasum -a 256`). Wrangler then warns on deploy that these
   aren't in `env.production.vars`: expected (production has them as secrets). Mention the secrets
   in the production env's secrets comment.
4. **Integration test.** In the project's API test: wrong password → 401; right one → 200 with a
   session whose user sees the seeded data; a change, then a second sign-in → seed restored, same
   user id. Run it against the local stack.
5. **App.** Add `reviewSignIn(email:password:)` to the Swift backend client (POST to the Worker,
   then the same session handling as the other sign-ins: factor the token-response parsing into one
   function), a model method that routes like the other sign-ins and turns 401 into "Wrong email or
   password.", and the UI below. Add a Debug launch argument `-reviewSignIn` that signs in through it
   with the local values (screenshots and checks without typing). Flutter (Waypack): the same pieces
   in Dart.
6. **Design** (the owner rejected a bare text link and form fields on the sign-in screen as "too
   ugly"):
   - Sign-in screen: one quiet full-width text button **"Sign in with email"** under the Apple and
     Google buttons, `.subheadline.weight(.medium)`, `.secondary` color, `.buttonStyle(.plain)`, 34 pt
     tall. No fields on the sign-in screen itself. Never hide it (a hidden reviewer entry risks
     guideline 2.3.1), never call it "review" or "test" in the UI.
   - Sheet (`EmailSignInSheet`): close button top right (circle, `.quaternary`), title
     "Sign in with email", one line "For accounts <App> gave you. New here? Continue with Apple or
     Google.", email and password in one rounded grouped card (`secondarySystemBackground`, 14 pt
     radius, divider between), red error label with an icon, a full-width `.borderedProminent`
     `.large` "Sign in" button with a spinner while busy. Focus the email field on appear; return
     moves to password, then submits. `.presentationDetents([.medium])`, corner radius 28, and an
     **opaque** `.presentationBackground(Color(uiColor: .systemBackground))`: the default glass sheet
     shows the screen behind through the form. `textContentType(.username / .password)` so
     reviewers get AutoFill.
   - Check both screens in the simulator with `-production` (hides Debug-only local sign-in UI) and
     look at the screenshots before calling it done.
7. **Production.** Write `projects/<name>/review.env` (Headway's is the template: `REVIEW_EMAIL`,
   `WORKER_DIR`, `WRANGLER_ENV`, `SITE`, `BUNDLE_ID`, `REVIEW_NOTES`). The notes tell the reviewer
   where the entry is ("tap Sign in with email below Continue with Google"), that email sign-in is
   only for accounts we hand out, what the demo data is, and which features need hardware (Even G2
   glasses, a watch) and aren't required. Then, after the Worker change is deployed:
   ```sh
   scripts/review_account.sh <project> --dry-run
   scripts/review_account.sh <project>          # password → ~/Credentials/review-accounts.env,
                                                # Worker secrets, live sign-in check, App Store Connect
   scripts/review_account.sh <project> --asc-only   # once a new version exists in App Store Connect
   scripts/review_account.sh <project> --rotate     # new password everywhere
   ```
   App Store Connect needs the API key (`ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_KEY_PATH`, or the shell
   profile's `FA_ASC_*`: run it from `zsh -ic` if they aren't in the environment). Review details
   belong to a version: with no editable version the script says so; rerun with `--asc-only` later.
   The app version that reviewers get must contain the "Sign in with email" entry: release it before
   submitting.
8. **Docs.** The project's `CLAUDE.md`: the local demo account, the `-reviewSignIn` argument, the
   Worker module in the architecture list. Its What's New doesn't need it (it isn't a user feature).

## Also check: account deletion (guideline 5.1.1(v))

Reviewers check that an app that creates accounts can delete the account **in the app**. Our users
are shared across HEJI apps (`auth.users`), and **no app may affect another** (owner decision
2026-10-29): "Delete account" deletes the app's own rows and files (its `USER_TABLES`, its bucket
folder, its assistant grants) and never the auth user, which other HEJI apps may still use. Wee
Hours also revokes its own Sign in with Apple token (that revocation is per app). Check the app's
delete flow does this, and that its confirm text doesn't claim to end other apps' accounts.

## Pitfalls

- `-reviewSignIn` runs from the sign-in screen's `.task`, which SwiftUI cancels when the signed-in
  screen replaces it: a refresh still running then fails with "cancelled". Make the model's
  `refresh()` run its work in its own `Task { … }.value` (Headway and FitLoop do).
- Demo data that depends on dates (a plan's `starts_on`, a commute's times) must be computed at
  reset time, not stored: FitLoop starts its demo plan on the Monday before the current week.

- The endpoint must be reachable before any auth check, and listed wherever the Worker routes
  `/api/*` first (`run_worker_first`).
- `crypto.subtle.timingSafeEqual` needs equal lengths: compare the hex digests, as the template does.
- The test account email is lowercased on both sides; reviewers type it as they like.
- Don't store the password in the repo, the Worker or the docs: only its SHA-256 goes to the Worker,
  the clear password to `~/Credentials/review-accounts.env` (mode 600) and App Store Connect.
- `scripts/review_account.sh` checks the live sign-in, which resets the demo account: fine any time
  except mid-review.
