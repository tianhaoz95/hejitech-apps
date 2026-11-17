# Decisions

## 1. Moved into the monorepo, off Firebase (2026-11-17)

Icecap came from `tianhaoz95/icecap` (history imported, rewritten first: a committed Stripe test
key file removed from every commit, author emails unified). The owner's decisions:

- **Backend:** the shared HEJI Supabase project (schema and bucket `icecap`) and one Cloudflare
  Worker, like the other projects. Firebase (Auth, Firestore, Functions, Hosting, Remote Config,
  Storage, AI Logic) is gone. Nobody used the Firebase version, so no data was copied.
- **Stripe:** the shared HEJI account (`scripts/stripe_pro.mjs icecap`, metadata `app=icecap`), with
  Headway's billing code. The old account's keys aren't reused.
- **AI:** on-device only, like Contempo, Waypack and Voxbrief: Chrome's built-in model through the
  Prompt API (`@icecap/ai`). No cloud model, so no AI quotas and no Pro Max tier.
- **Versions restart** under `icecap-v` tags (`v*` is Waypack's). The extension starts at 0.2.0, above
  the Chrome Web Store's 0.1.4.
- **Dependencies updated:** React 19, Vite 8, Tailwind 4, Vitest 5; Plasmo and the pnpm/Turborepo
  setup replaced by plain Vite builds in the npm workspaces.
- **Code is public** with the rest of the monorepo; secrets never are.

## 2. One Worker for every page

The seven Firebase Hosting sites became one Vite build served by one Worker on
`icecap.hejitech.workers.dev`: the waitlist page is the home page, the dashboard is `/app/`, admin
`/admin/`, privacy `/privacy/`, terms `/terms/`, the promo studio `/promo/`. The old landing page
(superseded by the waitlist page, with copy that no longer matched the plans) and the docs app
(replaced by these pages) were dropped, as was `experimental/`. The design notes and reports from
the old repo are kept under `docs/archive/` as they were; they describe the Firebase version.
`icecap.io` was never ours (it's parked for sale), so nothing points at it.

## 3. Pro: yearly with a free week, or lifetime

The old plans (Pro $19/month with an AI quota, Pro Max $49/month without) existed to pay for cloud AI.
With AI on the device, Icecap Pro follows the other HEJI apps: one yearly price with a 7-day free
trial on the first purchase, or a lifetime unlock, at $99.99 and $199.99 (set in Stripe, read live by
the Worker; change them there). Promotion codes are Stripe's own (entered at checkout); the custom
promo-code tables and admin page were dropped. Free Pro is a grant by email
(`scripts/grant_pro.sh icecap`, or the admin page).

## 4. What Pro unlocks

As before the move: the extension needs Pro (the side panel asks for it after sign-in), and so does
the web co-pilot. The dashboard itself only needs a sign-in, so saved deals stay readable.

## 5. Extension ids and sign-in

Google sign-in goes through Supabase (PKCE) inside `chrome.identity.launchWebAuthFlow`, returning to
`https://<extension id>.chromiumapp.org/`. The Web Store assigns `gbjiibgccfkpodffchmnokflclbnbfpl`;
the manifest `key` pins unpacked and sideloaded builds to `cljkjphaofjfagcekpbnkonpepdcciba`. Both
are on the shared project's redirect allow-list. The Web Store zip is built without `key`.

## 6. Admins

Admin used a Firebase custom claim. Now `icecap.admins` lists user ids
(`projects/icecap/scripts/make_admin.sh <email>`), and only the Worker reads it. Admin shows
counts, Pro accounts (paid and given, with give/take-away) and the waitlist. The scraper-health and
system-health pages were dropped: nothing ever wrote their data.

## 7. Account data

"Delete my data" in Settings removes the account's deals and settings (`DELETE /api/account`). The
HEJI sign-in is shared with the other apps, so it stays, as everywhere in the monorepo.
