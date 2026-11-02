---
name: heji-promo-video
description: Make a HEJI project's promotional video end to end -- a heji-report site that walks the owner through it (story and voiceover script, look and feel, Google Flow character and shot prompts with the screen hidden, music prompts for Flow Music, copy and download buttons everywhere), real screen recordings of the app made by a scripted Playwright run on the local stack, a voiceover generated locally with Kokoro, the edit in Remotion cut to the music's beats (30 s 16:9 plus 15 s 16:9 and 9:16), loudness-normalised renders shown in the report for review, then the YouTube upload kit for every cut (titles, descriptions, thumbnails, SRT subtitles), and the video embedded on the project's landing and docs pages. Use when asked to "make a promo video", "create a promotional video for <project>", "launch video", "a video for YouTube / socials", "help me make a video with Google Flow", "guide me through making a trailer", or when continuing a branding/promo-videos/<project>-<promo> edit.
---

# Promo video for a project

For a longer how-to-use walkthrough built on real screens (chapters, zooms, callouts), use
`heji-demo-video`; it reuses this skill's tools and lessons.

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
| YouTube fields, thumbnails, subtitles per cut | you | report section with the first render; owner uploads |
| Embeds on the landing and docs pages | you | after the owner sends the link |

## Where every file goes (absolute paths, this Mac)

Every agent and the owner use these exact folders, so nobody has to guess where a take landed.
`<id>` is the promo's id (`<project>-<promo>`, e.g. `headway-launch`); `<report>` is its report folder (`<date>-<project>-promo-video`).
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
- **Voiceover and music are required**, not optional. Flow makes music but not narration (a
  character's Flow voice only speaks their lines on camera); generate the narration yourself.
- **Characters are made in four Flow fields, never one block**: portrait, body, character info,
  voice (§2, "Characters in Flow"). That matches Flow's character maker step by step, and the
  owner can redo one step without the others.
- **A wearable product is part of the character.** When the product is glasses, a ring or a watch,
  put it in the portrait and body prompts so it looks the same in every shot, and have the lead wear
  it from the first frame; don't write "no glasses" and add them later in one shot.
- **A reference image sets the look, not the story.** When the owner attaches a screenshot for the
  character's style, take the character type, wardrobe cues, light and film grade from it, never its
  setting or plot. Set the story in the product's own world (a city commuter app gets a modern city
  story), unless the owner says otherwise.
- **Flow shots come with the characters' voices.** With a voice on the character, Flow speaks the
  quoted lines in the shot prompt (and sometimes ad-libs). Transcribe every shot (faster-whisper,
  word timings) before cutting: use the good lines as on-camera audio and captions, drop those words
  from the narration, mute the ad-libs. Headway's edit: `src/headway-launch/Composition.tsx` (`Line`
  with `shot`/`from`).
- **Picking between music takes without ears**: compare their structure against the prompt
  (librosa beat tracking for BPM and steadiness; RMS every 0.5 s over the section the edit will use,
  i.e. the last N seconds, for the stop, the build and a clean ending), pick the one that matches the
  story's beats, and say in the report that it was picked by measurement and how to swap.
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
   | Storyboard + Flow | Flow settings card (confirm before generating: Always; Video · Ingredients; 16:9; draft and keep settings), one character card per person (portrait prompt, body prompt, character info, voice: §2), one card per shot (time range, what it's for, the prompt, Keep/Regenerate tag) |
   | Screen recordings | the recordings as videos, what each shows, how to re-record |
   | Voiceover + music | the voice takes to pick from (m4a players), the music prompts for 30 s and 15 s |
   | Stills (spare) | screenshots and close-ups, light/dark, 16:9 and 9:16, for posts and thumbnails |
   | YouTube upload | §6 below: per cut title, description, thumbnail, SRT; shared settings once |
   | Steps + checklist, risks | ordered steps, `ul.checks` with stable ids, a risks table |

3. **Create the promo's folder in `branding/promo-videos` now**, in the same step as the report, so
   the owner has somewhere to drop Flow takes and music from day one (`branding/README.md`, "Adding
   a promo"). The promo is `<project>-<promo>` (`headway-launch`):
   - `mkdir -p branding/promo-videos/src/<promo> branding/promo-videos/public/<promo>` (`public/` is
     git-ignored; the folder just has to exist).
   - `src/<promo>/media.md`: the table of files (empty), then what's expected (the Flow shots, the
     recordings with their script name, the voiceover takes, the music) and a pointer to the report.
   - `src/<promo>/Composition.tsx`: until the media arrives, the storyboard as an **animatic**, one
     card per beat at the report's times (shot, the recording that follows, the voiceover line), id
     `<promo>-30`, 1920×1080 at 30 fps (a `Sequence` per beat over the brand colour, Inter from
     `shared/Caption`), so the pace can be checked in Studio. The edit replaces it (§5).
   - Register it in `src/Root.tsx`, then `cd branding/promo-videos && npm run lint` and one
     `npx remotion still <promo>-30 <scratch>.png --frame=<n>` to check it renders.
   - Keep the animatic's beats in step with the report when the story changes.
4. Serve it (`NO_OPEN=1`) and give the owner the URL. Iterate on their notes (Copy summary hand-off).

## 2. Story and scripts

- 30 s ≈ 7 voiceover lines, 26–28 s of speech; 15 s ≈ 4 lines, 13–14 s. Lines short enough to read
  as captions. Describe what the product does and the control the user keeps; never promise results.
- 7 Flow shots is plenty: a problem moment, two or three moments with the product's device
  (screen hidden), one or two "what happens behind the scenes" shots, an end card shot. Each shot's
  card says which recording follows it.
- Music prompts: instrumental, a stated BPM (~104), 4/4, "clear downbeats on every bar so a video can
  be cut to it", a structure with times (tense intro, groove, a one-bar drop, a resolving end),
  "leave space in the mids for a voiceover". Flow Music won't hit the length exactly; that's fine (§5).

### Characters in Flow

One character card per person in the report (the lead, plus a foil if the joke needs one: Headway's
Lin and Max). Flow builds a character in four places; give each its own `.field` with Copy, labelled
`<Name> · <n> · <field>` in this order, so the owner pastes top to bottom:

| # | Flow field | Where | What goes in it |
|---|---|---|---|
| 1 | Portrait prompt | Characters → New → "Describe your character…" | Name, age, one line of personality; face; hair; the product if it's worn (glasses, ring, watch); only the clothing a head-and-shoulders crop shows; "no logos, no text"; light, background, "head-and-shoulders portrait facing the camera", 85mm. The owner makes 2–4 and keeps one. |
| 2 | Body prompt | Portrait selected → **Create body** → "What do you want to change?" | Opens "Keep the face, hair, \<worn product\> and expression exactly the same. Show them full length, head to toe"; build, height, posture, a pose that fits the character, props in hand; the whole outfit head to toe, shoes included; "no logos, no text, no brand marks"; same light and background as the portrait, 50mm. |
| 3 | Character info (the character's intro) | The saved character's page → "Character info (optional): Describe how your character acts…" (the Flow agent uses it when it crafts scenes) | Who they are in the story and their running joke; how they move and react on camera (pace, gestures, looks to camera or never); recurring props and habits (the coffee, the ring tap, the phone held screen-away); that they speak only the short lines written into a shot's prompt and the narration is added later. Plain prose, ≤1,000 characters (`data-max="1000"`). |
| 4 | Voice | The character's page → **Select a voice** → pick, Sample dialogue, Customize performance → Preview → **Add to character** | Three fields: the **voice name** to pick from Flow's list (each is labelled gender, quality, pitch: e.g. Achernar "female, soft, high pitch", Achird "male, friendly, mid pitch"; suggest one that fits and say the owner may prefer another); the **sample dialogue** (≤120 characters, `data-max="120"`: the character's actual on-camera lines, so the preview is useful); **customize performance** (≤400 characters: tone, pace, energy, attitude, where to pause or rise, what to avoid such as "never salesy"). |

How the voice fits the narration:

- Give each character one or two short lines on camera, written in quotes into the shot prompts
  (Lin, deadpan to camera: "Me? I don't run."; Max, sprinting: "Hold the door!"). Funny lines land
  better in the character's own voice with lip-sync.
- The narration stays Kokoro (§4). Pick the Kokoro voice closest to the lead's Flow voice (a soft,
  high Flow voice → `af_bella` / `af_heart`) so they sound like one person; the edit keeps Flow's
  audio only for the on-camera lines and the narration skips those words. If the two voices don't
  match, mute Flow and narrate everything. Say this in a note under the voiceover scripts.
- Mute Flow's sound everywhere else: the edit's music and narration replace it.

When a field changes after the owner has made the character, tell them which to redo: a changed
portrait or body prompt means regenerating the character (and any shots made with it); a changed
character info or voice only means pasting the new text on the character's page.

Flow generation settings go in a card before the shots: **Video · Ingredients** (the saved
characters are the ingredients; Frames animates a still), **16:9** for every shot, drafts on the
fast model at 720p · 8s · x1 (close-ups can be 6s), and the take to keep re-run on the best model at
the highest resolution offered (1080p if available; the final video is 1080p) at x2.

## 3. Screen recordings (you)

Products that aren't web pages: Headway's `scripts/headway-launch-record.mjs` is the model.

- **Glasses (Even Hub simulator):** start it with `--automation-port`, poll `/api/screenshot/glasses`
  (~12 fps) while sending gestures to `/api/input`, join the frames with the concat demuxer; the
  lit pixels are in alpha (`alphaextract`, then `colorchannelmixer` to the HUD green). Don't use
  `color=` sources with `-shortest` in a filter graph: ffmpeg never ends.
- **iPhone notifications:** `xcrun simctl push` with the app's real alert texts, recorded with
  `simctl io recordVideo` (variable frame rate: re-encode at 30 fps), status bar fixed with
  `simctl status_bar override`. Notifications must be allowed first and `simctl privacy` can't grant
  them: tap "Allow" once with a throwaway XCUITest (`XCUIApplication(bundleIdentifier:)` from a tiny
  host project in the scratchpad). A fresh install avoids a stale signed-in state.
- Stage demo data the board shows as live (a stored realtime snapshot, a demo commute), restore the
  seed afterwards, and stop the Worker and simulators.

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
- Render the three compositions **one at a time, with `--concurrency=2`**, and check framing from frames of the render (`ffmpeg -vf fps=1,tile=…`), not from a batch of `remotion still` calls: each render or still starts its own Chrome, and 20+ in parallel ran a 16 GB Mac out of memory and crashed it.
- Then normalise in two passes (single-pass loudnorm lands about 1.5 LU low and can overshoot the peak): measure with `-af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -`, then apply with the measured values and `linear=true`, `-c:v copy`, into `out/final/<id>.mp4`.
  (~−14 LUFS for social platforms). Copy `out/final/*.mp4` plus poster JPGs into the report's
  `media/edit/` and add "The edit" section, plus the YouTube upload kit (§6) in the same pass. Say what you checked (stills, durations, loudness) and
  that the owner must watch and listen.
- List every file in `src/<promo>/media.md` (Flow takes can't be regenerated exactly).

## 6. YouTube upload kit (always, with the first render)

YouTube is where every promo lives (the pages embed it from there), so every promo gets this
section, added **with the first render**, not after approval: the owner can upload the moment they
like a cut, and a re-cut only means re-running the scripts. Worked example: §8 of
`reports/2026-10-30-headway-promo-video`. The section is "YouTube upload: what to fill in, for each
cut", placed after the audio/stills sections and before the steps; every value in a `.field` with
Copy and `data-max`, every file an `a.dl`.

**Files, in the report's `site/media/youtube/`** (small, so they're committed with the report, unlike
`media/edit/`):

| File | How |
|---|---|
| `<id>.srt` for **each** cut (30 s, 15 s, 9:16) | `node scripts/<promo>-srt.mjs out/final`, copied from `scripts/headway-launch-srt.mjs`: the composition exports a `SPEECH` table (`{ "<id>": { lines, end, words } }`, the same line placements it renders), the script bundles `Composition.tsx` with esbuild into `out/` (so packages resolve) and writes one cue per spoken line, held 0.4 s past its last word but never into the next cue. Include the characters' on-camera lines and the tagline even when the video shows it on the end card instead of a caption. Read the files back: every line, in order, no overlaps. |
| `<id>-thumbnail.jpg` per cut | the end card: `ffmpeg -ss <t> -i out/final/<id>.mp4 -frames:v 1 -vf scale=1280:720 -q:v 2 …`; the 9:16 at `scale=1080:1920`. Look at each one. |

**Layout:**

1. A table of the three uploads and their visibility: the **30 s is the main video**, Public (or
   Unlisted until the pages are updated), the one the site and docs embed, so upload it first; the
   **15 s 16:9 Unlisted**, a link for ads and sharing without a near-copy on the channel; the **9:16
   a Short**, Public (vertical and under 3 min, so YouTube makes it a Short by itself).
2. **One subsection per cut**: title (≤100; the Short's can be the story's hook plus `#Shorts`),
   description (≤5000: the story's hook in one line, what it does from the project's docs, link to the
   app and its docs page, the disclaimer: not affiliated with …, numbers/prices/alerts are demo data,
   people and scenes are AI-generated, the narration is a synthetic voice; 1–2 hashtags; shorter for
   the 15 s and the Short), the thumbnail shown with its download, and the video file and SRT
   downloads. Keep the subsection's downloads in it: a wide table full of file links is unreadable
   at phone width.
3. **The same for all three**, once, in Studio's order:
   - **Details:** upload the cut's thumbnail (custom thumbnails need a phone-verified channel; if the
     button is greyed out, Select from video → the end card). A Short's cover is a frame picked in the
     YouTube app after upload; Studio on the web may not take a file for it. A playlist named after
     the product. Not made for kids, no age restriction.
   - **Show more:** tags (≤500), paid promotion unticked (own product), **altered or synthetic
     content: Yes** (realistic AI people and a synthetic voice), no automatic chapters, language
     English, caption certification "never aired on U.S. television", Standard license, **Allow
     embedding: on** (required for the pages), category Science & Technology, comments held for review.
   - **Video elements:** Add subtitles → Upload file → With timing → the cut's SRT (for a Short:
     Studio → Content → the Short → Subtitles). Say that the burned-in captions mean CC shows the words
     twice, and why the file still helps (sound-off embeds, search, translation). No end screen (it
     covers the end card), no cards.
   - **Checks:** Flow footage and music are the owner's, Kokoro is Apache 2.0, so a claim is unlikely;
     ask them to report what a claim names.
   - **Visibility:** as in the table; Private can't be embedded ("Video unavailable"). Then: send the
     30 s link for §7.
4. **Elsewhere:** a short post (≤280) for X / Threads.

Also: a `YouTube` row in the summary's status grid, steps "review with sound" and "upload with §N",
checklist items per upload (`<p>-yt30`, `<p>-yt15`, `<p>-ytshort`), the SRT command in
`src/<promo>/media.md`, and `nextSteps` saying to re-run the SRT script and recopy after a re-cut.
Check the section at phone width (no overflow) and fetch every `a.dl`.

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
