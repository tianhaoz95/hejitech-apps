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

## Observed in the simulator (2026-10-23)

The glasses' font is narrow: a 25-character line fills about 40% of the 576 px width. The 25
characters per line limit is the PRD's (glanceability, not space), so it stays; whether the text is
big enough to read on a moving train is a question for the on-device check.

## Open (PRD §15 defaults applied)

TL;DR on by default; 12 cards for a new user; text footer `♪ DEEP DIVE 4 MIN`; a method keyword on
every discovery card; the five templates; free-text `instructions`.
