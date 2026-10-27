# Even Hub listing

What to paste and upload in the Even Hub developer portal for `com.hejitech.weehours.glasses`.
Field rules and portal guidelines: `.claude/skills/heji-even-hub-submit/SKILL.md` (repo root).

## Text

- **Name:** `Wee Hours` (matches `app.json` and the glasses; 20 characters max, no "Even").
- **Tagline** (50 characters max): `Hands-free newborn log for feeds, diapers & sleep`
- **About:**

  > Wee Hours is a hands-free newborn log for feeds, diapers, sleep and growth on your Even G2
  > glasses and R1 ring. When your hands are full at 3 a.m., log everything without picking up your
  > phone.
  >
  > On the glasses:
  > - **Press** (ring or temple): starts a feed (bottle or nursing), or finishes the open one.
  > - **Swipe**: opens the quick menu (log diaper: wet, dirty, both, dry; fell asleep / woke up;
  >   switch side; switch child; duty handoff; undo last; exit).
  > - **Hold**: speak while holding ("drank 90 ml", "left side"). Your paired household iPhone
  >   transcribes it and logs the entry next time Wee Hours opens.
  > - **Double-tap**: on the root status screen, opens the system exit dialog back to Even OS;
  >   in menus or pickers, cancels back to status.
  >
  > Works without an account on first launch in interactive Demo mode (sample baby Maya), where every
  > ring and temple gesture responds immediately.
  >
  > For real household sync, pair with the Wee Hours iPhone app: sign in to your household, go to
  > Settings → Even G2 glasses, tap "Get pairing code", and enter the 6 digits on the phone page in the
  > Even app. Feeds and sleep sync instantly with your partner.

- **Category:** Lifestyle (everyday integrations).
- **Tags** (5 max): `baby, newborn, parenting, nursing, tracker`
- **Access permissions required:**
  - Microphone of Even Smart Glasses (`g2-microphone` in `app.json`): "Hold to speak a log entry; your phone turns it into an entry"
  - Network is listed by the portal automatically from `app.json`: "Send your log entries and voice captures to your household"
- **Data collection:**
  - Location tracked: No
  - AI technology used: No (voice recognition and natural language processing run entirely on-device on the user's iPhone)
  - Other rows (data type → purpose, purpose ≤ 50 characters):
    - Email address → Signing in to your household
    - Baby log entries → Showing feedings, diapers and sleep
    - Voice captures → Audio sent to your phone for transcription
    - Paired devices and tokens → Connecting your glasses, iPhone and partner
- **Third-party services:** `Supabase (data, audio): supabase.com/privacy`,
  `Cloudflare (API): cloudflare.com/privacypolicy`, `Google Sign-In: policies.google.com/privacy`,
  `Sign in with Apple: apple.com/legal/privacy`.
- **Release notes (first version on Even Hub):**
  - Hands-free newborn logging from Even G2 glasses and R1 ring.
  - Press to start/finish feeds; swipe for menu (diaper, sleep, switch child, duty, undo).
  - Hold to speak a voice note; your paired iPhone transcribes and logs it.
  - Double-tap on root status opens the system exit dialog.
  - Interactive demo mode lets you test all gestures without an account.
- **Privacy policy:** <https://weehours.hejitech.workers.dev/privacy/>
- **Terms:** <https://weehours.hejitech.workers.dev/terms/>
- **Support:** <https://weehours.hejitech.workers.dev/support/> · info@hejitech.com
- **Developer:** HEJI TECHNOLOGY LLC · info@hejitech.com (phone and address: business ones or blank)

## Images

| File | What |
| --- | --- |
| `icon-24.png` | Store icon (24 × 24, `#F4F4F4` on transparent, 2 × 2 blocks): a crescent moon and star. Made with `make-icon.mjs` from the grid below. `icon-preview-240.png` is the 240 × 240 preview. |
| `background-576x288.png` | Greyscale background: the app icon on black. |
| `screenshots/*.png` | Simulator exports (576 × 288 RGBA): root status (demo), quick menu, diaper picker, and hold-to-speak recording HUD. |

Icon grid (12 × 12 blocks, each block = 2 × 2 pixels):

```
............
...#####....
..##...##...
.##.....#...
.##.........
.##.....##..
.##.....##..
.##.........
.##.....#...
..##...##...
...#####....
............
```

## Notes for the reviewer

> Wee Hours works without an account: on first launch the glasses run in an interactive Demo mode
> (showing sample baby Maya), and every ring and temple gesture answers on every screen:
> - Press: toggles starting and finishing a bottle feed (flashing "Demo: Bottle feed started" and
>   "Demo: Bottle finished").
> - Swipe up or down: opens the quick menu (Log diaper, Fell asleep / Woke up, Duty, Undo last, Exit).
> - Selecting "Log diaper" opens the diaper picker ([wet] dirty both dry), and swiping/pressing logs it.
> - Hold: starts voice recording HUD ("● Listening… release to send"), and releasing flashes "Demo:
>   Captured ✓".
> - Double-tap on the root status screen calls `bridge.shutDownPageContainer(1)` to open the system
>   exit dialog; Exit is also available in the quick menu.
> - In sub-menus (diaper picker, quick menu), double-tap cancels back to the root status screen.
>
> To test with a real household, install Wee Hours on iPhone, sign in, open Settings → Even G2 glasses,
> tap "Get pairing code", and type the 6-digit code into the plugin's phone page inside the Even app.
> The plugin communicates exclusively with `weehours.hejitech.workers.dev` (our Cloudflare Worker API
> listed in the network whitelist) operated by HEJI TECHNOLOGY LLC.
