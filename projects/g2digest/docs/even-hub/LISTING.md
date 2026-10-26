# Even Hub listing

What to paste and upload in the Even Hub developer portal for `com.hejitech.g2digest.glasses`.
The portal's own form decides the exact fields. Submitting stays disabled until the listing has
developer information, screenshots, permission information and the icon. Rules this follows:
<https://hub.evenrealities.com/docs/ship/app-submission> and `../DEPLOY.md` §Even Hub.

## Text

- **Name:** `G2 Digest` (matches `app.json` and what the glasses show; 20 characters max, no "Even").
- **Tagline** (50 characters max): `Your daily brief as glanceable cards and audio`
- **Description:**

  > G2 Digest turns a brief you write into cards for your G2 glasses and audio for your headphones.
  > An agent you connect (Claude, for example) compiles each edition ahead of time: it researches
  > your sections, writes the cards and the audio, and checks every card against the display's
  > limits. On the way, swipe the R1 ring to skim the cards, tap for a short glance, and tap then
  > hold for the deep dive. Editions are saved on your phone, so they work offline.
  >
  > Needs a free G2 Digest account (sign in with Google at g2digest.hejitech.workers.dev) and an
  > agent that builds your editions. Until then, the glasses show a short tour.

- **Permission (network):** Fetch your editions and their audio from G2 Digest (same text as
  `app.json`).
- **Release notes (0.2.0):**
  - A short tour on the glasses until your first edition arrives.
  - Double-tap with nothing playing asks to exit; Exit is also in the menu.
- **Privacy policy:** <https://g2digest.hejitech.workers.dev/privacy/>
- **Support:** <https://g2digest.hejitech.workers.dev/support/> · info@hejitech.com
- **Developer:** HEJI TECHNOLOGY LLC · info@hejitech.com

## Images

| File | What |
| --- | --- |
| `icon-24.png` | Store icon, 24 × 24 RGBA: lit pixels `#F4F4F4` fully opaque, the rest fully transparent (the portal checks both), every lit pixel in a 2 × 2 block (a card with text lines). The portal has a 24 × 24 editor: the grid below redraws it there if uploading isn't offered. |
| `background-576x288.png` | Greyscale background (the icon's card, large, on black). The docs don't give a size, so it matches the display; resize if the portal asks for another. |
| `screenshots/*.png` | Simulator exports (`/api/screenshot/glasses`, RGBA, 576 × 288): the tour's cover, the ring card, a gesture's feedback flash, the next-step card, and the contextual menu. |

Icon grid (12 × 12 blocks, each block = 2 × 2 pixels):

```
............
.##########.
.#........#.
.#.######.#.
.#........#.
.#.####...#.
.#........#.
.#.#####..#.
.#........#.
.#.###....#.
.##########.
............
```

## Notes for the reviewer

> G2 Digest works without an account: on first launch the glasses play a seven-card tour, and every
> ring gesture answers on every card (swipe to move; tap and tap-then-hold flash "NO GLANCE AUDIO" /
> "NO DEEP DIVE" because the tour has no audio). Double-tap with nothing playing opens the system
> exit dialog; Exit is also in the contextual menu. Reading your own editions needs an account and
> pairing: sign in at g2digest.hejitech.workers.dev, open Pair, and type the 6-digit code into the
> app's phone page. The app only talks to g2digest.hejitech.workers.dev (our API, on Cloudflare)
> and our Supabase project's supabase.co address (expiring audio links), both operated by HEJI
> TECHNOLOGY LLC. (The exact Supabase address is the second entry of the app's network whitelist.)

Regenerate the images: run the plugin in the simulator (`CLAUDE.md` commands, unpaired so the tour
shows) and save `/api/screenshot/glasses` at each card.
