# Decisions

G2 Digest was built from PRD v1.0 (2026-10-22). The PRD's locked decisions stand as written; this
page records the owner's answers to the questions it left open, and the calls made while building
it, with the reason for each.

## The owner's answers (2026-10-22)

| Question | Answer |
|---|---|
| The companion card authoring guide (v0.2) and the 2026-10-22 fixtures weren't supplied | Write guide v0.2 from PRD §9–§10, and make a synthetic 2026-10-22 fixture edition. The owner may diff it against their copy later. |
| Who makes the audio | **The authoring agent**, not a server-side TTS: a multimodal agent's voice matches what it wrote. The MCP server gets `create_audio_upload` (signed upload URL, or inline ≤ 3 MB). |
| Which pipeline to wire to | None exists. Build an agent-agnostic one: one prompt (`pipeline/build-prompt.md`) plus the MCP server, runnable as a Claude routine or any agent on a cron. |
| The audio-on-lock spike (§7.3) | **Build both paths**: the spike page for the owner to run on the glasses, and the podcast-feed fallback, so nothing waits on the result. |

## Calls made while building

- **Worker, not Edge Functions.** The PRD says privileged calls go "through a Supabase Edge
  Function". The monorepo runs all server code in each project's Cloudflare Worker with the service
  key as a Worker secret (`supabase/README.md`: Edge Functions aren't used). The PRD's intent (no
  secrets in the plugin, a server-side gate, RLS as defence in depth) holds as written.
- **Bucket `g2digest`, not `g2digest-audio`.** The repo's isolation check requires the bucket to be
  named after the project. Audio lives at `<user_id>/<date>/<slug>-glance.mp3` and
  `-deep-dive.mp3`.
- **Profile + brief rows, one document.** PRD §11 puts language, units, glossary and delivery in
  `profiles`, and §9.2 puts them in the brief config. Both are true: they're stored in `profiles`,
  the rest in `briefs.config`, and the Worker joins them into the one §3.2 document that
  `get_user_brief` returns and the editor edits. Any change to either bumps `brief_version`.
- **All writes go through the Worker.** Clients only `select` their own rows (RLS); brief saves,
  pairing, tokens and publishing use the service key after the shared checks in `@g2digest/core`.
  Pairing codes aren't readable by clients at all.
- **Tokens are hashed and prefixed:** `g2d_` glasses (read-only, editions only), `g2f_` podcast
  feed (the feed and its audio only), `g2a_` build agent (MCP only). A device token can't read the
  brief, make codes or call MCP. Revoking deletes the row; the plugin fails closed to "pair again".
- **Pairing throttle:** 10 wrong codes per client address per 10 minutes, then even a right code
  waits. Six digits with a 10-minute life and single use.
- **"Publish without a preview render is an error" (`E_NO_PREVIEW`):** `validate_cards` renders the
  frames and the ASCII snapshot; an error-free validation stores the bundle's hash for 24 hours.
  `publish_cards` needs that hash for the exact bundle, validates again (guide, brief, uploaded
  audio), and stores the snapshot with the edition.
- **Six MCP tools, not four:** the PRD's four, plus `create_audio_upload` (the owner's audio answer)
  and `get_last_cards` (needed for `quiet_behavior: show_last`, and documented as never a template).
- **Audio belongs to the card on screen.** Swiping stops whatever plays; tap toggles the glance (or
  pauses a playing deep dive); tap-then-hold plays the deep dive; double tap stops. Predictable
  beats clever on the morning leg.
- **Long press and the contextual menu.** The plugin handles `LONG_PRESS_EVENT` as the deep dive
  and also registers a contextual menu (Deep dive, Glance audio, Stop audio, Next card), so it works
  whichever way the firmware routes "tap, then long-press". Which one the R1 sends needs the
  on-device check.
- **Bridge detection.** The SDK returns a bridge object even in a plain browser, so the plugin
  checks for the Even app's WebView handler (`flutter_inappwebview`) first, then waits up to 5 s.
- **Podcast fallback numbering.** Episodes are every audio file of an edition in card order, glance
  before deep dive (`episodes()` in core). In "podcast app" mode the glasses flash
  `PODCAST EPISODE n` instead of playing.
- **Offline.** The plugin keeps the last bundle in bridge storage and the audio files in Cache
  Storage (best effort; if the WebView lacks it, audio streams from 3-day signed URLs).
- **Validator extras.** Beyond the PRD's hard rules: only status cards can be alerts or quiet
  cards; a quiet or carried card is its section's only card; a metric section can't require deep
  dives; script numbers flag currency symbols, magnitude suffixes (`26B`) and numeric ranges.
  Warnings (not errors): a glance that reads the card aloud, an implausible duration, a deep dive
  with no methodology, a section card with no source.
- **The example brief is seed data only.** The reference user's brief (PRD §9) is in
  `packages/core/fixtures/reference-brief.json` and `supabase/seeds/g2digest.sql`; a new user gets
  a neutral one-section starter. `scripts/check-no-topics.mjs` (CI) fails if any of its names
  appear elsewhere. To make it the owner's real brief: paste the JSON into the brief editor's "Edit
  as JSON".

## Even Hub readiness (2026-10-24)

The submission checklist (hub.evenrealities.com, ship/app-submission) set these:

- **Double-tap exits when nothing plays.** Even Hub rejects a root page whose double-tap doesn't
  open the system exit dialog (`shutDownPageContainer(1)`). The plugin has one page, so double-tap
  stops audio when audio is on (or paused), and otherwise asks to exit. The contextual menu's "Stop
  audio" and the lock screen's stop button send the separate `stop` gesture, which never exits; the
  menu also has "Exit".
- **The tour instead of a message.** Reviewers install without an account, and the core flow must
  work on the glasses alone with every gesture answering. So whenever there's no edition (not
  paired, nothing published, offline with nothing fetched) the plugin plays a built-in seven-card
  bundle (`core/src/tour.ts`): how it works, the ring, and a next-step card for the reason. It has
  no audio, so tap and tap-then-hold flash their "no audio" notes. Its position isn't remembered.
- **No links on the plugin's phone page.** A link would navigate the Even app's WebView away from
  the plugin, so the site address, help and privacy are selectable text.
- **Privacy policy, support page, delete my data.** The listing needs a privacy policy covering the
  `network` permission. "Delete all my G2 Digest data" (Pair page, `DELETE /api/account`) removes
  every G2 Digest row, the audio and the OAuth grants. It keeps the sign-in, which is a HEJI account
  shared with the other apps; the policy says to email for that.
- **Not decided here:** a demo account for reviewers (the tour covers the core flow; ask Even
  Hub if they want one), and hosted edition building for users without their own agent (it would
  mean server-side AI and TTS, which PRD §3 and the owner's audio answer rule out for now).

## The list is home, dots show the position, editions start at the top (2026-10-26)

The owner's next round on the glasses:

- **The list of editions is the root page.** The plugin opens on it (newest first, 8 a page with
  Older/Newer rows); picking one opens its cards; on a card, a double tap with nothing playing (or
  swiping up past the End, whose footer says so, or "All editions" in the menu) goes back to it. The
  Even Hub rule, a double tap on the *root* page opens the system exit dialog, now applies to the
  list. When there's nothing to read, the tour is the root page and keeps that rule. The core state
  machine says `back` for a double tap with nothing playing and `editions` for swiping past the
  End; the plugin decides what each means on the page it shows.
- **An edition always opens at its first card.** Positions aren't remembered any more (the
  `g2digest:position` key is gone), and the 15-minute refresh never swaps the cards under the
  reader: it only updates the list.
- **Position dots.** A second, narrow text container (`DOTS_PX`, 22 px, no border, not capturing
  events, above the card in z-order) at the frame's right edge shows one `●`/`○` per card on the
  card's own line grid, top to bottom in reading order, so swiping up moves the `●` down. More cards
  than the frame's 9 rows: a window that keeps the `●` in view, with `↑`/`↓` for the rest
  (`positionDots`). The glyphs were checked in the simulator; the font has no `◦`. Lines wrap at
  510 px now (guide 0.4) to leave the dots their column. The web preview draws the same dots.
- **Offline,** the list shrinks to the edition kept on the phone (the latest), and that one opens.

## Swipe up moves on (2026-10-26)

On the R1, swipe up (`SCROLL_TOP_EVENT`) now goes to the next card and swipe down goes back, as the
owner expected from scrolling a page; it was the other way round. The list page is the firmware's
own and moves its highlight by itself.

## The whole display, a frame, past editions (2026-10-26)

After the owner's first days on the glasses:

- **Lines are measured in pixels, not characters.** The 25-characters-per-line rule (PRD) left
  most of the display empty: the font is proportional and narrow, so 25 characters cover about 40%
  of the width. The glyph widths were measured in the simulator (`core/src/font.ts`: each glyph
  drawn 10 and 30 times, widths differenced; the line pitch is 27 px) and the renderer now wraps at
  536 px (the frame's inner width less a 20 px margin for real-glasses metrics). The **150-character
  budget stays**: it is what keeps a card a glance. Guide 0.3 says this, so agents' editions follow.
- **A frame.** Like other G2 apps, the card is a bordered text container across the display
  (`FRAME`: 2 px, level 13, radius 6, 8 px padding); 9 lines fit inside, and the footer is pinned
  to the last one (`screenText`) so every card has the same shape. The web preview draws the same
  frame with a proportional face; its line breaks come from the renderer, so they match.
- **Past editions on the glasses** (superseded the same day: the list became the home page, above). Swiping up past the End card (the End's footer says so), or
  "Past editions" in the menu, opens a list page: up to 8 editions, newest first, with "Older" and
  "Newer" rows, since a list's rows share the frame's height. Clicking one reads it; double tap goes
  back to the cards (the list isn't the root page, so it doesn't exit). A past edition stays pinned
  until the reader picks the latest again, so the 15-minute refresh doesn't swap it out. The phone
  page lists the same editions as buttons. Past editions need the network (only the latest is kept
  offline).

## Observed in the simulator (2026-10-23)

The glasses' font is narrow: a 25-character line fills about 40% of the 576 px width. (Superseded
on 2026-10-26: lines are now measured in pixels, see above.)

## Open (PRD §15 defaults applied)

TL;DR on by default; 12 cards for a new user; text footer `♪ DEEP DIVE 4 MIN`; a method keyword on
every discovery card; the five templates; free-text `instructions`.
