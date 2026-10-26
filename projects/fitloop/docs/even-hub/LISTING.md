# Even Hub listing

What to paste and upload in the Even Hub developer portal for `com.hejitech.fitloop.glasses`.
Field rules and the portal's quirks: `.claude/skills/heji-even-hub-submit/SKILL.md` (repo root).

## Text

- **Name:** `FitLoop` (matches `app.json` and the glasses; 20 characters max, no "Even").
- **Tagline** (50 characters max): `Your agent's workout and meal plan, mid-set`
- **About:**

  > FitLoop puts the fitness and nutrition plan your own AI agent writes on your G2 glasses. Today's
  > workouts and meals in one list: open a workout to see each exercise, the set you're on and its
  > target, tap when the set is done and the rest timer starts; timed sets count down. Hold the R1
  > ring for the how-to cues, to skip an exercise or to tell your agent it was too hard, too easy or
  > hurt. Check meals off with a tap, or say you ate less, more or something else. Double-tap exits.
  > Works offline at the gym; check-ins send when you're back online.
  >
  > Needs a free FitLoop account (Google or Apple sign-in in the FitLoop iPhone app or at
  > fitloop.hejitech.workers.dev) and an AI agent you connect over MCP (Claude, for example) to
  > write your plan. Until you pair the glasses, they show a demo day. Not medical advice.

- **Category:** Health (wellness and fitness trackers).
- **Tags** (5 max): `fitness, workout, nutrition, training, ai`
- **Access permissions:** none to tick (the only permission is `network`, which the portal lists
  from `app.json`).
- **Data collection:** AI technology used: yes (the plan is written by the user's own AI agent).
  Other rows (data type → purpose, purpose ≤ 50 characters):
  - Email address → Signing in to your account
  - Plans → Showing the plan your agent wrote
  - Check-ins and notes → Tracking progress and telling your agent
  - Health data (if turned on) → Progress and your agent, if you allow
  - Paired devices and tokens → Connecting your glasses, phone and agent
- **Third-party services:** `Supabase (data, photos): supabase.com/privacy`,
  `Cloudflare (API): cloudflare.com/privacypolicy`, `Google Sign-In: policies.google.com/privacy`,
  `Sign in with Apple: apple.com/legal/privacy`.
- **Release notes (first version):**
  - Today's workouts and meals on the glasses, with set tracking and rest timers.
  - Hold the ring for how-to, skip and notes for your agent; double-tap exits.
  - Works offline; a demo day plays until you pair.
- **Privacy policy:** <https://fitloop.hejitech.workers.dev/privacy/>
- **Terms:** <https://fitloop.hejitech.workers.dev/terms/>
- **Support:** <https://fitloop.hejitech.workers.dev/support/> · info@hejitech.com
- **Developer:** HEJI TECHNOLOGY LLC · info@hejitech.com (phone and address: business ones or blank)

## Images

| File | What |
| --- | --- |
| `icon-24.png` | Store icon (24 × 24, `#F4F4F4` on transparent, 2 × 2 blocks): a dumbbell inside a loop. Made with `make-icon.mjs` from the grid below. `icon-preview-240.png` is the same, large. |
| `background-576x288.png` | Greyscale background: the app icon on black. |
| `screenshots/*.png` | Simulator exports, unpaired (the demo day a reviewer sees): today, a timed set running, the workout menu, the how-to. |

```
............
...######...
..#......#..
.#........#.
#..#....#..#
#.########.#
#..#....#..#
.#........#.
..#......#..
...####.##..
.......##...
............
```

## Notes for the reviewer

> FitLoop works without an account: unpaired, the glasses play a demo day (marked DEMO) from an
> example plan, and nothing is sent anywhere. Every ring gesture answers: on Today, swipe moves
> (and says so at either end), tap opens a workout or meal, hold opens the menu (progress, notes,
> refresh, Exit FitLoop) and double-tap opens the system exit dialog. In a workout, tap marks a set
> done (or starts and stops a timed set), swipe changes exercise, hold opens the workout menu
> (how-to, skip, notes, end) and double-tap goes back to Today; a meal checks off with a tap. Real
> plans need a FitLoop account, an AI agent connected over MCP and pairing (a 6-digit code from the
> FitLoop iPhone app, typed on the plugin's phone page). The app only talks to
> fitloop.hejitech.workers.dev, our server on Cloudflare, operated by HEJI TECHNOLOGY LLC. FitLoop
> gives no medical advice.

Regenerate the screenshots: run the plugin unpaired in the simulator (`CLAUDE.md`) and save
`/api/screenshot/glasses` on Today, a timed set, the workout menu and the how-to.
