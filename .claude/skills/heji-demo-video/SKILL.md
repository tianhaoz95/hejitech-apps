---
name: heji-demo-video
description: Make a HEJI project's product demo / walkthrough video end to end -- a heji-report site that plans it (the tasks to show as chapters, a step-by-step voiceover script, look and feel, Google Flow prompts for AI backdrops, bridge shots and chapter art, music prompts), real screen recordings and screenshots of the app made by scripted runs on the local stack with an event log of every tap and click, a Kokoro voiceover, and the edit in Remotion where the real UI is the star -- framed devices over generated backdrops, a camera that zooms and pans to follow each action, spotlights, callouts, step titles, a chapter bar and one family of smooth transitions -- rendered as a 60–120 s 16:9 walkthrough with YouTube chapters plus a 9:16 one-task short, the YouTube kit, and the video embedded on the project's docs and landing pages. Use when asked to "make a demo video", "product walkthrough video", "how-to video", "tutorial video", "onboarding video", "show how to use <project>", "feature tour", "explainer with real screens", or when continuing a branding/promo-videos/<project>-demo edit. For a short story-driven ad, use heji-promo-video instead.
---

# Demo walkthrough video for a project

A walkthrough teaches: the viewer should finish it knowing how to do the 3–5 things the product is
for, and enjoy watching. It is built from the same parts as a promo (`heji-promo-video`: read it
first, its lessons and tools apply here unless this file says otherwise), with the weight flipped:

| | Promo (`heji-promo-video`) | Demo walkthrough (this skill) |
|---|---|---|
| Star | AI-generated people and story | the real app, on screen ≥ 70 % of the time |
| AI content | the shots | backdrops, chapter art, short bridges, the opener |
| Screens | hidden in Flow shots | real recordings and screenshots, readable, zoomed onto the action |
| Length | 30 s + 15 s cuts | 60–120 s 16:9 with YouTube chapters + one 9:16 short (one task, ≤ 45 s) |
| Pace | cut every 2–4 beats | one action at a time, held long enough to follow; music underscores |
| Voiceover | hook lines | step by step: what to tap and what happens, second person |

The style to aim for is the polished SaaS / Google product-film look: the real UI floats in a clean
device frame over a rich generated backdrop, the camera glides in on whatever is being touched,
everything else dims, short labels pop in beside it, and every chapter flows into the next without a
hard cut. Enjoyable comes from motion, rhythm and a little wit in the script, never from hiding the UI.

| Piece | Made by | How |
|---|---|---|
| Chapters, script, shot list | you | §2, in the report |
| Recordings, screenshots, event logs | you | §3: Playwright (web), simulator (iOS/watch/glasses), owner on a device for what can't be scripted |
| Backdrops, chapter art, opener, bridges | owner | Google Flow (images and video), from prompts in the report |
| Voiceover | you | Kokoro-82M locally, as `heji-promo-video` §4; owner picks a voice |
| Music | owner | Flow Music, from prompts in the report |
| Edit, captions, renders | you | Remotion (`heji-remotion`), §5 |
| YouTube kit with chapters | you | §6, with the first render |
| Embeds on docs and landing pages | you | after the owner sends the link |

## Where every file goes (absolute paths, this Mac)

Every agent and the owner use these exact folders, so nobody has to guess where a take landed.
`<id>` is the demo's id (`<project>-demo`); `<report>` is its report folder (`<date>-<project>-demo-video`).
The repo is the **main checkout** at `/Volumes/DATA/GitHub/hejitech-apps`. Media is git-ignored, so
it exists only there: from a worktree or any other checkout (e.g. `/Volumes/DATA/GitHub/hejitech-g2digest-ready`),
still read and write media at the paths below, never in your own checkout's `branding/`.

| What | Absolute path | Written by |
|---|---|---|
| Every source asset the edit uses: Flow shots, images and art, music takes, the owner's device recordings, your recordings (`rec-*.mp4`, event logs), screenshots, voiceover takes | `/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/<id>/` (flat, no subfolders; `staticFile("<id>/…")` reads it) | owner drops Flow downloads here; you write the rest |
| The list of those files, where each came from | `/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/src/<id>/media.md` (tracked) | you, every time a file is added or replaced |
| The edit (code), voiceover timings | `/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/src/<id>/` (tracked) | you |
| Recorder, voiceover and SRT scripts | `/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/scripts/<id>-*` (tracked) | you |
| Raw renders | `/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/out/<composition>.mp4` (ignored) | `npx remotion render` |
| Final, loudness-normalised renders and SRTs | `/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/out/final/` (ignored) | you |
| Copies the owner reviews in the report | `/Volumes/DATA/GitHub/hejitech-apps/reports/<report>/site/media/` (`edit/` renders + posters, ignored by convention; `rec/`, `audio/`, `stills/` review copies; `youtube/` thumbnails + SRTs, committed) | you, copied from the folders above, never the only copy |
| Throwaway frames, stills to check, temp audio | the session's scratchpad directory | you; never put an asset the edit needs there |

- Tell the owner the `public/<id>/` path (absolute) in the report's summary and in every Flow/music
  card ("download into …"), and accept files they leave in `~/Downloads` only by moving them there
  and adding them to `media.md`.
- Name files so another agent can tell what they are (as the existing folders do): Flow shots keep
  Flow's download name with the shot number in front (`Shot_3_draft_09a6abcf_1080p.mp4`, the kept
  take re-run at full quality as `shot-3_<flow id>_1080p.mp4`), `art-<name>.png` for Flow images,
  `music-<len>s-take<n>-<title>.mp3` (the trimmed track the edit plays: `music-<len>-edit.wav`),
  `rec-<beat or chapter>.mp4` (+ `.events.json` for demos), `still-<screen>.png`,
  `vo-<voice>-<line or chapter>.wav`.
- Before starting work, `ls` the `public/<id>/` folder and read `media.md`: a previous agent's
  files are the source of truth; don't re-download or re-record what's already there.

## Rules that matter most

- **The screens are real.** Every frame that shows the product is a recording or screenshot of the
  real app (local stack, demo data). Never ask Flow to draw the app's UI, never put a generated
  screen where the viewer would read it as the product, never mock a feature that doesn't ship.
  Generated content may show *around* the product: a backdrop, a scene with the screen hidden, an
  abstract metaphor (a notification becoming a paper plane), chapter art.
- **Show one action at a time, then let it land.** Each step: the camera moves to the target (~0.5 s),
  the tap or click happens, the result is held ≥ 1 s before the next move. A step the viewer can't
  follow at 1× is too fast; split it. Speed up only the boring parts (typing, loading) and say so
  with a small `2×` badge.
- **The camera follows the action.** Zoom (1.4–2.2×) and pan onto the element being touched, driven
  by the recorder's event log (§3), eased in and out (spring, no linear moves), back to the full
  screen between steps so the viewer keeps their bearings. UI text in the final frame must be large
  enough to read on a phone: ≥ ~28 px tall at 1080p.
- **One transition family per video,** chosen in the look-and-feel section and used everywhere:
  e.g. a cross-zoom into the device at the start of a chapter, a blur-slide between chapters, a
  match cut where a UI element (a card, a button) scales up into the next chapter's title. No
  random mix of wipes. No hard cut except on a strong music downbeat.
- **Everything is always gently moving** (slow push-in, parallax between device and backdrop, a
  slight 3D tilt that settles flat when the user is about to interact), but never while text is
  being read: the device holds still during a step.
- **Prices, health, money and safety numbers are demo data** and say so (`DemoLabel` on every
  recording, disclaimer on the end card), as in the promo.
- Lessons from the promos still hold: Flow prompts say "video", one self-contained prompt per shot,
  "no logos, no text"; voiceover and music are required; music picked by measurement when there are
  several takes; render one composition at a time with `--concurrency=2`; two-pass loudnorm.

## 1. Read the project, then scaffold the report

1. Read `projects/<name>/CLAUDE.md`, its docs (`projects/<name>/docs/index.md`: the tasks a user
   does are the chapters' raw material), its app screens, brand colours, icon and safety rules
   (local stack, seed data, no real actions), and any existing promo (`branding/promo-videos/src/<project>-launch`:
   reuse its voice, palette, characters and music where it fits, so the brand feels the same).
2. Scaffold with `heji-report` (`.claude/skills/heji-report/new.sh <name>-demo-video "<Name> walkthrough video"`)
   and follow its rules (public repo, `.fields` with Copy, `a.dl` downloads, checklist, hand-off).
   Sections, in this order:

   | Section | Contents |
   |---|---|
   | Summary | status grid (chapters agreed, recordings, Flow art, voiceover, music, edit, YouTube), a "what to redo" table once there's a cut, one callout: what the owner does next |
   | The edit (once rendered) | both cuts as `<video>` with posters and downloads, the chapter list with times, a table on pace, zooms, transitions, captions, sound |
   | Chapters + script | who the video is for, the task list (§2), per chapter: goal, the steps on screen, voiceover lines (Copy), the recording it uses |
   | Look and feel | palette, backdrop style, device frames, the transition family, callout and title style, type, what never appears |
   | Flow art | Flow settings card, then one card per asset: opener, one backdrop per chapter (still image and/or slow looping video), bridges, end card art; each with its prompt and a Keep/Regenerate tag |
   | Recordings + screenshots | every recording as a video with its event-log summary, the screenshots, how to re-record |
   | Voiceover + music | voice takes to pick from (m4a), the music prompts |
   | YouTube upload | §6 |
   | Steps + checklist, risks | ordered steps, `ul.checks` with stable ids, a risks table |

3. Create the demo's folder in `branding/promo-videos` in the same step (`branding/README.md`,
   "Adding a promo"). The id is `<project>-demo` (a second one: `<project>-demo-<topic>`):
   `src/<id>/media.md`, `src/<id>/Composition.tsx` as an **animatic** (one card per step at the
   script's times, chapter titles, the recording each step uses; 1920×1080, 30 fps, id `<id>`),
   registered in `src/Root.tsx`, then `npm run lint` and one `npx remotion still`.
4. Serve it (`NO_OPEN=1`), give the owner the URL, iterate on their notes.

## 2. Chapters and script

- **Pick the tasks first, then write.** 3–5 chapters, each one thing a new user wants to do
  ("Add your first trip", "Share it with your partner"), in the order a new user meets them. Cut the
  rest; the docs cover it. Agree the list with the owner before recording.
- **Arc** (≈ 90 s): hook (0–6 s: the end result or the problem, in the opener art plus one real
  screen) → what it is in one line → chapters (15–25 s each: title card ~1.5 s, then the steps) →
  recap (the chapters as a quick montage of their best frames, ~5 s) → end card (name, where to get
  it, docs link, disclaimer).
- **Voiceover:** second person, present tense, conversational, ~140 words a minute (slower than the
  promo); one sentence per step naming what to touch and what it gets you ("Tap **Pack**, and
  Waypack sorts the list by bag."). Use the UI's exact labels, in bold in the report, so the viewer
  recognises them on screen. One light joke or human moment per chapter at most. Never promise results.
- **Write the steps as a table the recorder can follow**: step id, screen, action (tap/click/type/swipe
  with the target's selector or label), what the viewer should notice, voiceover line, hold time.
  This table is the contract between the script, the recording (§3) and the edit (§5).
- **Short (9:16):** the single most impressive task, start to finish, ≤ 45 s, hook in the first 2 s,
  phone recording full-height. Its own script lines in the report.
- **Music prompts:** instrumental, warm and light, ~90–110 BPM, 4/4, clear downbeats every bar, long
  even sections (no big drops in the middle: it underscores teaching), a soft intro, a lift for the
  recap, a clean resolving ending, "leave space in the mids for a voiceover", length ≈ the cut + 10 s.

## 3. Recordings, screenshots and the event log (you)

Start from the promo recorders: `branding/promo-videos/scripts/tradeboard-launch-record.mjs` (web,
Playwright + CDP screencast) and `headway-launch-record.mjs` (simulator, Even Hub glasses). Copy to
`scripts/<id>-record.mjs` and change three things:

1. **One recording per chapter, following the script's step table**, not one per story beat. Real
   pacing: wait for each result to render, hold for the step's hold time. Desktop viewport ~1280×720
   at 2× (or 1120×630 when the UI is dense), phone 390×844 at 3×.
2. **Write an event log next to every recording**, `public/<id>/rec-<chapter>.events.json`:
   for each step, `{ step, t, type, x, y, box: {x, y, w, h}, label }` in the recording's own pixels
   and seconds (t of the action, the target element's bounding box from `locator.boundingBox()`, or
   from the XCUITest element frame on iOS). The edit's camera, spotlight and callouts read this file,
   so a re-record re-aims everything automatically; never hand-place zooms.
3. **Clean frames:** a fake cursor and tap ripple injected on the web (as the promo does), no
   cursor on phone recordings (the edit draws the touch), status bar fixed (`simctl status_bar
   override` 9:41, full battery), notifications and banners only when a step is about them.

- **Screenshots** of every chapter's key screen, light and dark, at device resolution, for the
  recap, the thumbnail and stills. Put a copy in the report.
- **What can't be scripted** (camera, real watch or glasses hardware, Live Activities, a real
  device's feel): list the clips in the report and ask the owner to record them on the attached
  iPhone with built-in Screen Recording (status bar clean, Do Not Disturb on, demo account), and
  drop them in `public/<id>/`. Simulators are fine for scripted recordings (clean, repeatable, the
  status bar can be fixed); say which footage came from where.
- Seed and reset a demo account, stage the data each chapter needs, restore the seed and stop the
  stack and simulators afterwards.

## 4. Voiceover (you)

As `heji-promo-video` §4: copy `scripts/tradeboard-launch-vo.py` to `scripts/<id>-vo.py`, one take
per chapter (so a re-recorded chapter only re-voices itself), speed ~0.95–1.0 (tutorial pace), word
timings from faster-whisper into `src/<id>/voiceover.ts`. Voice: the one the project's promo used,
if any. Each step's line should end before its hold time does; adjust the hold, not the speech rate.

## 5. The edit (you, with `heji-remotion`)

Reuse `src/shared/` (`Cuts`, `DesktopRecording`, `PhoneRecording`, `FlowShot`, `KineticCaption`,
`CaptionBand`, `DemoLabel`). The first demo video adds the walkthrough pieces to
`src/shared/Walkthrough.tsx` (generic, no product names, never importing from a demo) and becomes
this skill's worked example; update this file with its paths when it ships.

| Piece | What it does |
|---|---|
| `DeviceStage` | the device frame (phone, laptop, browser window, watch, glasses HUD) with a soft shadow, over a backdrop (Flow still or loop, with slow parallax); takes a 3D tilt that springs to flat before the first step |
| `FollowCamera` | reads the chapter's event log and animates scale and translate so the step's `box` sits centred at the chosen zoom, springing in ~0.5 s before `t` and back out after the hold; clamps so the frame never shows past the screen's edge |
| `Spotlight` | dims everything but the target's box (rounded, ~60 % black, feathered), on for the hold |
| `TouchMark` | a tap ripple / press dot at `(x, y)` on phone recordings, a cursor highlight ring on desktop |
| `Callout` | a short label (≤ 5 words, the UI's own words) with a line to the box, popping in after the tap, placed on the side with room |
| `StepTitle` | the chapter's title card: number, title, a one-line goal, over that chapter's backdrop; enters with the video's transition |
| `ChapterBar` | a slim progress bar with chapter names at the top or bottom, the current one lit; hidden on the opener and end card |
| `Recap` | a grid or quick montage of each chapter's best frame, with its title |

- Build each chapter as its own `Sequence`, timed from the voiceover's word timings and the event
  log: the camera reaches the target just before the voiceover names it.
- Music: as in the promo (start so the track ends on its own ending, duck to ~0.3 under the
  voice); cut chapter changes and title cards on downbeats, but let steps follow the voice.
- Captions: `KineticCaption` lines at the bottom, kept clear of the `ChapterBar` and callouts.
- 9:16 short: `<id>-short`, phone recording full height over a cropped backdrop, larger callouts,
  no chapter bar, its own end card.
- Export `CHAPTERS` (`[{ title, start }]`, seconds, first at 0) and `SPEECH` (as the promo's) from the
  composition, so the SRT and the YouTube chapter list come from the edit itself.
- Check stills at every step's hold (`npx remotion still`, one at a time) for framing, legibility and
  callouts clear of the target; `npm run lint`; then render each composition one at a time with
  `--concurrency=2` and normalise to −14 LUFS in two passes, as in the promo. Copy the finals and
  posters into the report's `media/edit/`, add "The edit" and the YouTube kit in the same pass.
  Say what you checked and that the owner must watch it with sound, on a phone too.

## 6. YouTube kit and pages

As `heji-promo-video` §6–7, with these differences:

- **Two uploads:** the walkthrough (Public, the one the docs embed) and the short (Public, a Short).
- **Chapters in the description:** generated from `CHAPTERS` (`0:00 Intro`, then one line per
  chapter, recap/end last). YouTube needs the first at 0:00, at least three, each ≥ 10 s: check.
- **Title** says what the viewer learns ("How to plan a trip with Waypack in 90 seconds"); the
  description lists the tasks, links the docs, and carries the disclaimer (demo data, AI-generated
  backdrops and art, synthetic narration; altered or synthetic content: Yes if any realistic
  generated people or scenes appear).
- **Thumbnail:** a real screenshot in its device frame over the backdrop with ≤ 4 words, made in
  Remotion as a still composition (`<id>-thumb`, 1280×720), not a frame of the end card.
- **Pages:** the docs page gets a "Watch the walkthrough" section near the top (lazy
  `youtube-nocookie` iframe in `.promo-video`); where a docs section explains a chapter's task, link
  it to the chapter's timestamp (`?start=<s>` / `&t=<s>s`). The landing page keeps the promo as its
  hero video and links the walkthrough under "How it works" (or embeds it if there is no promo).

## Never

- Draw the product's UI with AI, or show a feature that doesn't ship.
- Record production, a real account, real tokens or personal data, or trigger a real action.
- Commit media (`public/`, `out/`, the report's `media/edit/`); commit or push without being asked;
  publish anything (the owner uploads).
