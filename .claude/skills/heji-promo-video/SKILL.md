---
name: heji-promo-video
description: Make a HEJI project's promotional video end to end -- a heji-report site that walks the owner through it (story and voiceover script, look and feel, Google Flow character and shot prompts with the screen hidden, music prompts for Flow Music, copy and download buttons everywhere), real screen recordings of the app made by a scripted Playwright run on the local stack, a voiceover generated locally with Kokoro, the edit in Remotion cut to the music's beats (30 s 16:9 plus 15 s 16:9 and 9:16), loudness-normalised renders shown in the report for review, then the YouTube upload fields, thumbnail and captions file, and the video embedded on the project's landing and docs pages. Use when asked to "make a promo video", "create a promotional video for <project>", "launch video", "a video for YouTube / socials", "help me make a video with Google Flow", "guide me through making a trailer", or when continuing a branding/promo-videos/<project>-<promo> edit.
---

# Promo video for a project

The worked example is Trading Plan Board's launch video: report
`reports/2026-10-30-tradeboard-promo-video` (or `reports/archive/…` once archived), edit
`branding/promo-videos/src/tradeboard-launch`, scripts `branding/promo-videos/scripts/tradeboard-launch-*`.
Read them before starting: copy their structure and adapt it, don't rebuild from scratch.

The video is a 30-second main cut plus 15 s cuts in 16:9 and 9:16. The report is the owner's
cockpit: they make the AI footage and the music in Google Flow; you make everything else.

| Piece | Made by | How |
|---|---|---|
| Story, voiceover script, shot list | you | §2 below, in the report |
| People and places (Flow shots) | owner | Google Flow, from prompts in the report |
| The product on screen | you | real screen recordings (Playwright, local stack) |
| Voiceover | you | Kokoro-82M, locally; owner picks a voice |
| Music | owner | Flow Music, from prompts in the report |
| Edit, captions, renders | you | Remotion (`heji-remotion`) |
| YouTube fields, thumbnail, captions file | you | report section; owner uploads |
| Embeds on the landing and docs pages | you | after the owner sends the link |

## Lessons that shaped this (don't relearn them)

- **No green screens.** Keying a screenshot onto a Flow-generated screen looked shaky and covered
  the hand when the actor tapped. Flow shots **hide the screen** (laptop lid towards the camera, back
  of the phone, over-the-shoulder at an angle where the screen can't be read) and the product appears
  as a **real screen recording**, cut to with a transition. Say "the screen is never visible" in
  every shot prompt that shows a device; "no logos" on devices and clothing.
- **Fast pace.** The first cut (one shot per voiceover line) was too slow. Cut on the music's beats,
  every 2–4 beats (≈1.2–2.3 s at ~104 BPM); use only the first 1.5–3 s of each Flow shot.
- **No rigid hard cuts.** Shader transitions from `@remotion/transitions`: cross-zoom from a shot
  into its recording ("diving into the screen"), blur-slide between story beats, dreamy zoom into
  the end card; plus slow push-ins on everything so no frame sits still.
- **Voiceover and music are required**, not optional. Flow makes music but not voiceover (Flow's
  "voice" is for characters on camera); generate the voiceover yourself.
- **One combined character prompt** (face, body, outfit, framing in one block, for Flow's "Describe
  your character…") and the character reused across shots keeps the person consistent.
- **Prompts say "video"** and each shot prompt is one self-contained copy (character name, action,
  camera, light, length, "screen never visible"), so the owner pastes once per shot.
- **Prices and numbers on screen are demo data** and say so ("Demo data" tag on every recording,
  disclaimer on the end card) whenever the product touches money, health or safety.

## 1. Read the project, then scaffold the report

1. Read `projects/<name>/CLAUDE.md`, its docs (`projects/<name>/docs/index.md`: the tagline and the
   features are the story's raw material), the app's pages and its brand colours/icon. Note the
   project's safety rules: recordings run on the **local stack with seed data only**, never
   production, never real accounts, tokens or personal data, and nothing that performs a real
   action (orders, payments, messages to real people).
2. Scaffold with `heji-report` (`.claude/skills/heji-report/new.sh <name>-promo-video "<Name> promo video"`)
   and follow its rules (public repo, copy buttons via `.fields`, downloads via `a.dl`, checklist,
   hand-off). Sections, in this order (the § numbers are referenced across the page, so fix the
   order early):

   | Section | Contents |
   |---|---|
   | Summary | status grid (Flow shots, recordings, voiceover, music, edit), a "what to redo" table once there's a first cut, one callout: what the owner does next |
   | The edit (once rendered) | the three cuts as `<video>` with posters and downloads, a table on pace, transitions, captions, sound, 9:16, on-screen labels |
   | Story | the 30 s arc (problem → product → how it works → safety/trust → tagline), voiceover scripts for 30 s and 15 s with Copy buttons |
   | Look and feel | palette from the brand, light, lenses, mood; what never appears (logos, readable screens, real data) |
   | Storyboard + Flow | Flow agent settings card (confirm before generating: Always; 16:9; draft model, final model), the character card, one card per shot (time range, what it's for, the prompt, Keep/Regenerate tag) |
   | Screen recordings | the recordings as videos, what each shows, how to re-record |
   | Voiceover + music | the voice takes to pick from (m4a players), the music prompts for 30 s and 15 s |
   | Stills (spare) | screenshots and close-ups, light/dark, 16:9 and 9:16, for posts and thumbnails |
   | YouTube upload | §6 below |
   | Steps + checklist, risks | ordered steps, `ul.checks` with stable ids, a risks table |

3. Serve it (`NO_OPEN=1`) and give the owner the URL. Iterate on their notes (Copy summary hand-off).

## 2. Story and scripts

- 30 s ≈ 7 voiceover lines, 26–28 s of speech; 15 s ≈ 4 lines, 13–14 s. Lines short enough to read
  as captions. Describe what the product does and the control the user keeps; never promise results.
- 7 Flow shots is plenty: a problem moment, two or three moments with the product's device
  (screen hidden), one or two "what happens behind the scenes" shots, an end card shot. Each shot's
  card says which recording follows it.
- Music prompts: instrumental, a stated BPM (~104), 4/4, "clear downbeats on every bar so a video can
  be cut to it", a structure with times (tense intro, groove, a one-bar drop, a resolving end),
  "leave space in the mids for a voiceover". Flow Music won't hit the length exactly; that's fine (§5).

## 3. Screen recordings (you)

Copy `branding/promo-videos/scripts/tradeboard-launch-record.mjs` to `scripts/<promo>-record.mjs`:

- Start the project's local stack (its CLAUDE.md says how), reset and seed a demo account with
  believable demo data, then record one short scripted **beat** per story moment (board, detail,
  approve on a phone viewport, result, failure handled safely).
- Playwright with CDP `Page.startScreencast`, frames joined by ffmpeg's concat demuxer into 30 fps
  MP4s in `public/<promo>/rec-<beat>.mp4`. Desktop viewport ~1120×630 at 2× (text readable in a
  1080p frame), phone 390×844 at 3×. Inject a fake cursor and tap ripple so clicks read on video.
- Force a repaint at the start (a static page gives a one-frame screencast), use `page.clock` to
  fast-forward polling instead of reloading, and don't auto-scroll past what the beat shows.
- Stop the stack when done.

## 4. Voiceover (you)

Kokoro-82M (Apache 2.0, free for commercial use), locally on the Mac (or the DGX Spark if it's up,
see memory). Copy `scripts/tradeboard-launch-vo.py`: a uv venv on Python 3.12, misaki's espeak
fallback replaced by one that fails on out-of-dictionary words (the bundled espeak-ng crashes on
macOS; reword instead), five voices (`af_heart`, `af_bella`, `am_michael`, `am_fenrir`, `bf_emma`),
speed nudged until each take lands in the target length. Read every take back with faster-whisper
(pass decoded PCM as a numpy array) to check the words and get **word timings** for the captions;
put them in `src/<promo>/voiceover.ts`. Put m4a copies in the report for the owner to pick.

## 5. The edit (you, with `heji-remotion`)

In `branding/promo-videos` (layout and rules: `branding/README.md`). Reuse `src/shared/`:
`Cuts.tsx` (clips by cut time in seconds, transitions centred on each cut), `Product.tsx`
(`FlowShot`, `DesktopRecording`, `PhoneRecording`), `Caption.tsx` (`KineticCaption` word-by-word over
a `CaptionBand`, `DemoLabel`). Model the composition on `src/tradeboard-launch/Composition.tsx`.

- Measure the music's BPM and beat grid (ffmpeg/librosa) and place every cut at `n * beat`.
- When a track is longer than the cut, start it so it **ends on the track's own ending**
  (`trimBefore` = track length − cut length); fade it in over a few frames and duck it under the
  voiceover (music ~0.4, voiceover ~7 dB above).
- Skip the tagline caption when the end card already shows it; the end card carries the disclaimer.
- 9:16: size 16:9 footage to the frame height and centre it (not `objectFit`), taller recording
  windows zoomed onto the content (`focus` for left-aligned pages), a 9:16 end-card still.
- Check with stills (`npx remotion still`) at every cut before rendering; `npm run lint`.
- Render the three compositions, then normalise: `ffmpeg -i out/<id>.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:v copy out/final/<id>.mp4`
  (~−14 LUFS for social platforms). Copy `out/final/*.mp4` plus poster JPGs into the report's
  `media/edit/` and add "The edit" section. Say what you checked (stills, durations, loudness) and
  that the owner must watch and listen.
- List every file in `src/<promo>/media.md` (Flow takes can't be regenerated exactly).

## 6. YouTube upload section (once the owner approves a cut)

When the owner uploads, add a "YouTube upload: what to fill in" section in the order YouTube Studio
asks, every value in a `.field` with Copy (and `data-max`):

- **Details:** title (≤100), description (what it does, link to the app, disclaimer, "prices are
  demo data", "people and scenes are AI-generated", 1–2 hashtags), thumbnail (1280×720 JPG of the end
  card, `ffmpeg -ss <t> -i out/final/<id>.mp4 -frames:v 1 -vf scale=1280:720`; custom thumbnails need
  a phone-verified channel), playlists empty, not made for kids, no age restriction.
- **Show more:** tags (≤500), paid promotion unticked, **altered or synthetic content: Yes** (realistic
  AI people and a synthetic voice), no automatic chapters at 30 s, language English, caption
  certification "never aired on U.S. television", Standard license, **Allow embedding: on**,
  category Science & Technology, comments held for review.
- **Video elements:** subtitles from an SRT built from the voiceover timings
  (`scripts/tradeboard-launch-srt.mjs`; note the burned-in captions mean YouTube's CC can double them);
  no end screen (it covers the end card); no cards.
- **Visibility:** Public, or Unlisted to wait; Private can't be embedded.

## 7. Put it on the pages

When the owner sends the link, check it's embeddable
(`curl "https://www.youtube.com/oembed?url=<link>&format=json"` returns 200), then:

- **The app's landing page.** If the project has none (the root is the signed-in app and visitors
  only see a sign-in form), build one first: Trading Plan Board's `services/web/welcome/` (hero,
  how it works, safety, what you need, fine print), served at `/` to visitors without a session
  cookie by the Worker (`"/"` in `run_worker_first`, `Vary: Cookie`), with Terms and Privacy pages
  and a "By continuing you agree…" line on sign-in. The video is a click-to-play 16:9 poster served
  by the app itself (`public/promo-poster.jpg`) that swaps in a
  `youtube-nocookie.com/embed/<id>?autoplay=1&rel=0` iframe on click, so nothing loads from YouTube
  until then (`projects/tradeboard/services/web/src/welcome.ts`, the `.promo` styles); the privacy
  page says so. Check the Worker's security headers allow it (a CSP needs `frame-src` for
  youtube-nocookie.com; `X-Frame-Options` doesn't matter here). Give the wrapper `width: 100%`, or
  the iframe shrinks to 300 px.
- **The docs page:** edit `projects/<name>/docs/index.md` (not `pages/<name>/`, a git-ignored copy):
  a "See it in 30 seconds" section with a lazy `youtube-nocookie` iframe in `.promo-video`
  (styled in `pages/.vitepress/theme/custom.css`).
- Check both at desktop and phone width, light and dark, and click play. If `pages:dev` is broken,
  check with `npm run pages:build` + `vitepress preview pages`.
- Record the YouTube id in `src/<promo>/media.md` and mark the report's status.

## Never

- Record production, a real account, real tokens or personal data, or trigger a real action.
- Commit media: `branding/promo-videos/public/` and `out/` are ignored; the report's rendered MP4s are
  large (tens of MB), so leave `media/edit/` out of git unless the owner says otherwise.
- Commit or push without being asked; pushing redeploys the app's Worker and the docs site.
- Publish anything (YouTube, socials): the owner uploads.
