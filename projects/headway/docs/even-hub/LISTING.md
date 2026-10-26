# Even Hub listing

What to paste and upload in the Even Hub developer portal for `com.hejitech.headway.glasses`.
Field rules and the portal's quirks: `.claude/skills/heji-even-hub-submit/SKILL.md` (repo root).

## Text

- **Name:** `Headway` (matches `app.json` and the glasses; 20 characters max, no "Even").
- **Tagline** (50 characters max): `Your next Caltrain, at a glance`
- **About:**

  > Headway shows the next Caltrain departures on your G2 glasses: times, live delays from
  > Caltrain's feed and service alerts, in a frame you read at a glance. It opens on a live board
  > right away. Swipe the R1 ring to move through the next trains, tap to flip direction, hold for
  > the menu (track the train you're on, pick any two stations, alerts) and double-tap to exit.
  > Tracking a train shows the next stop and the minutes to yours.
  >
  > With a free Headway account (sign in with Google or Apple in the Headway iPhone app or at
  > headway.hejitech.workers.dev), pair the glasses with a code to see your morning and evening
  > commute automatically and get iPhone alerts for delays, cancellations, when to leave and before
  > your stop. Without pairing it shows any two stations you pick. Not affiliated with Caltrain.

- **Category:** Travel (navigation and transit).
- **Tags** (5 max): `caltrain, train, commute, transit, bay area`
- **Access permissions:** none to tick (the only permission is `network`, which the portal lists
  from `app.json`: "Fetch live Caltrain departures and your saved commute from Headway").
- **Data collection:** AI technology used: no (assistants can read your board over MCP, but nothing
  on the glasses is AI-made). Other rows (data type → purpose, purpose ≤ 50 characters):
  - Email address → Signing in to your account
  - Stations and alert choices → Showing your commute and sending alerts
  - Paired devices and tokens → Connecting your glasses, iPhone and assistant
  - Tracked train → Alerting you before your stop
- **Third-party services:** `Supabase (data): supabase.com/privacy`,
  `Cloudflare (API): cloudflare.com/privacypolicy`, `Google Sign-In: policies.google.com/privacy`,
  `Sign in with Apple: apple.com/legal/privacy`, `511.org (transit data): 511.org/about/privacy`.
- **Release notes (first version):**
  - Live Caltrain board with delays and alerts; opens on San Francisco to San Jose until you pick.
  - Hold the ring for the menu: track your train, pick stations, alerts. Double-tap exits.
  - Pair with the Headway iPhone app for your commute and alerts.
- **Privacy policy:** <https://headway.hejitech.workers.dev/privacy/>
- **Terms:** <https://headway.hejitech.workers.dev/terms/>
- **Support:** <https://headway.hejitech.workers.dev/support/> · info@hejitech.com
- **Developer:** HEJI TECHNOLOGY LLC · info@hejitech.com (phone and address: business ones or blank)

## Images

| File | What |
| --- | --- |
| `icon-24.png` | Store icon (24 × 24, `#F4F4F4` on transparent, 2 × 2 blocks): the front of a train. Made with `make-icon.mjs` from the grid below. `icon-preview-240.png` is the same, large, to look at. |
| `background-576x288.png` | Greyscale background: the app icon on black. |
| `screenshots/*.png` | Simulator exports, unpaired (what a reviewer sees): the board, the menu, tracking a train. |

```
............
..########..
.#........#.
.#.##..##.#.
.#.##..##.#.
.#........#.
.##########.
.#.#....#.#.
.##########.
..#......#..
.#........#.
............
```

## Notes for the reviewer

> Headway works without an account: it opens on a live board of the next trains from San Francisco
> to San Jose (Caltrain's timetable, with live delays when Caltrain's feed has them). Every ring
> gesture answers: swipe moves the cursor (and says so at either end), tap flips direction, hold
> opens the menu (track the selected train, pick any two stations, alerts, refresh, Exit Headway),
> and double-tap on the board opens the system exit dialog. On the menu, the station picker and a
> tracked train, double-tap goes back to the board. A personal commute and alerts need a Headway
> account and pairing (a 6-digit code from the Headway iPhone app, typed on the plugin's phone
> page). The app only talks to headway.hejitech.workers.dev, our server on Cloudflare, operated by
> HEJI TECHNOLOGY LLC.

Regenerate the screenshots: run the plugin unpaired in the simulator (`CLAUDE.md`) and save
`/api/screenshot/glasses` on the board, after a hold (menu) and after tapping "Track".
