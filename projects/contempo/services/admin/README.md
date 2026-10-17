# Admin

Internal admin site for coupon management, served by the Contempo Worker at
`https://contempo.hejitech.workers.dev/admin/` (built and copied into the Worker's assets by
`npm run assemble -w @contempo/web`). Not linked from anywhere public; not indexed
(`<meta name="robots" content="noindex, nofollow">` in `index.html`).

In-app reports and the `/feedback/` form go to Contempo's FeedbackKit project, so feedback is
triaged in FeedbackKit (dashboard, Portal app or `npx feedbackkit-cli`), not here.

## Access control

- **Authentication**: Supabase Auth with Google (`signInWithOAuth`, `src/auth/AuthContext.tsx`),
  the same accounts as the apps.
- **Authorization**: the user needs a row in `contempo.admins`. There's no UI for that; add rows
  by hand (SQL editor or the service role). RLS lets a user read only their own row, which is how
  the site decides whether to show `AccessDeniedPage`.
- **Enforcement**: the Worker checks `contempo.admins` again on every `/api/admin/*` call, so a
  signed-in non-admin can't reach coupon management by bypassing the UI.

## Features

- **Coupons** (`src/pages/CouponsPage.tsx`): lists, creates, deactivates and deletes Stripe
  Coupons + Promotion Codes through the Worker's `/api/admin/coupons/*` (the Stripe key never
  leaves the server). A coupon is always created together with a promotion code (the string a
  host types at checkout); bare coupons with no code (e.g. made by hand in the Stripe Dashboard)
  show up in a secondary section.

## Local dev

```bash
npm run dev -w @contempo/admin     # from the repo root; .env.development points at the local stack
npm run build -w @contempo/admin
```
