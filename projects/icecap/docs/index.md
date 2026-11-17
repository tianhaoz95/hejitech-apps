---
layout: home
hero:
  name: "Icecap"
  text: "Every listing, run like an investor would"
  tagline: "A Chrome extension that scores Redfin, Zillow and Realtor.com listings as you browse (cash flow, cap rate, cash-on-cash, flip and short-term rental math) and a dashboard for the deals you save. The AI runs on your own computer."
  image:
    src: /icecap/icon.png
    alt: Icecap
  actions:
    - theme: brand
      text: Open Icecap
      link: https://icecap.hejitech.workers.dev
    - theme: alt
      text: Chrome Web Store
      link: https://chromewebstore.google.com/detail/gbjiibgccfkpodffchmnokflclbnbfpl
    - theme: alt
      text: Decisions
      link: /decisions

features:
  - title: Napkin math in the side panel
    details: Price, taxes and HOA come off the listing page; rent starts at a 0.7% guess you adjust. Long-term rental, short-term rental, flip and BRRRR numbers update as you move the sliders, and map pins show cash flow on search pages.
  - title: Saved deals, everywhere you sign in
    details: Save a deal from the extension and it appears in the dashboard right away. Compare deals side by side, change assumptions, and let the co-pilot propose a change you confirm.
  - title: On-device AI
    details: Deal summaries, red flags and the co-pilot run on Chrome's built-in model. Listings and questions never leave your computer, and there's no AI quota.
---

## How it fits together

```mermaid
flowchart LR
  ext["Chrome extension<br/>(side panel, content scripts)"] -- "deals, settings (RLS)" --> sb[("Shared Supabase<br/>schema icecap")]
  web["Web app on the Worker<br/>home · /app · /admin"] -- "deals, settings (RLS)" --> sb
  ext -- "Pro, Stripe" --> worker["Worker /api"]
  web -- "Pro, Stripe, waitlist, admin" --> worker
  worker -- "service key" --> sb
  worker <--> stripe["Shared HEJI Stripe<br/>(metadata app=icecap)"]
  ext -. "on-device" .-> nano["Chrome's built-in model"]
  web -. "on-device" .-> nano
```

- **Extension** (`apps/extension`): Manifest V3, built with Vite. Content scripts read the listing and
  badge map pins; the side panel does the math (`@icecap/math`), saves deals and runs the AI.
- **Web app and API** (`services/web`): one Cloudflare Worker serves the home page and waitlist, the
  dashboard (`/app/`), admin (`/admin/`), privacy and terms, the promo studio, and `/api`.
- **Pro**: a yearly plan with a free week, or lifetime, through the HEJI Stripe account; or given by
  email. The extension and the co-pilot need it.

More: [Decisions](./decisions) · [Deployment](./DEPLOY) · the project's
[README](https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/icecap).
