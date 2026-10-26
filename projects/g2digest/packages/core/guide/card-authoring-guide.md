# G2 Digest card authoring guide

guide_version: 0.3

This guide covers the **form** of a G2 Digest edition: card anatomy, budgets, the template
registry, audio and validation. It's the same for every user. The **content** (what goes in a
brief: sections, sources, instructions) is each user's own brief config, which they edit in the web
app and you fetch with `get_user_brief`. Never take topics, companies or sources from this guide,
from an earlier edition, or from memory: they come from the brief only.

Always fetch this guide live (`get_card_authoring_guide`) at the start of a build. Don't keep a copy
in your prompt. Every bundle records the `guide_version` it was built against, and publishing is
refused when the guide has changed since.

## 1. Who reads this, and when

The user takes the edition in later, in a hostile moment: a moving train, no hands, short
attention, and a real risk of motion sickness from reading. So:

- **Audio is the primary channel.** The glasses are for glances of a second or two, never for
  sustained reading.
- **A card has one job: a ~2-second decision.** Swipe on (skip) or hold (hear the deep dive).
  Depth always arrives as audio, never as more text.
- **Nothing happens at reading time.** Everything is compiled ahead into one self-contained
  bundle: the full edition, the cards and finished audio files.

## 2. Card form

### 2.1 Hard limits (errors)

The display is 576 × 288 px, monochrome green, and the card is a bordered frame across all of it.
One card fills one screen and never scrolls. The glasses' font is proportional, so lines are
measured in pixels: a line holds about 50 characters of ordinary text.

| Rule | Limit | Code |
|---|---|---|
| Lines per card, kicker and footer included | ≤ 9 | `E_LINES` |
| Line width in the glasses' font (the renderer word-wraps; a single word wider than this fails) | ≤ 536 px | `E_LINE_WIDTH` |
| Characters per card, every line counted (alignment padding counts as one space) | ≤ 150 | `E_CHARS` |

The 150-character budget is what keeps a card a glance, not the space: a full card is still three
or four lines, with the footer at the bottom of the frame. You don't place line breaks yourself:
`title` and `body` are single lines of text, and the renderer wraps them at word boundaries.
`validate_cards` returns the rendered frames, so you can see exactly what will show.

### 2.2 Anatomy (fixed order)

1. **Kicker**: the section title and n/N within the section (`ALERT` for a promoted alert).
   Rendered for you.
2. **Title**: actor + what happened. If something is reported but not confirmed, the attribution
   goes in the title ("Report: X weighs sale").
3. **Body**: one plain sentence.
4. **Method/topic keyword**: ≤ 4 words (`method_keyword`), shown in capitals. Every `discovery`
   card has one, including when the method isn't the news.
5. **Footer**: deep-dive availability and length (`♪ DEEP DIVE 4 MIN`, `♪ 25S · NO DEEP DIVE`,
   `NO AUDIO`). Rendered for you from the audio you attach; while audio plays the plugin swaps it
   for the player state.

The `metric` template puts up to three `LABEL ...... VALUE` lines between the title and body, and
the body is the one driver line.

### 2.3 Exactly one key number

Every section card carries **exactly one** key number (`key_number`), e.g. `41%`, `$2.1B`, `3x`,
`0.92`. It must:

- appear verbatim in the card's title or body (`E_KEY_NUMBER`);
- appear verbatim in the full edition (`E_KEY_NUMBER_EDITION`): cards are derived from the finished
  edition, never from raw search results;
- be the only number in the title and body (`E_EXTRA_NUMBER`). Digits inside names ("G2", "v4")
  don't count; years and dates do, so leave them out of the card.

Exempt: `metric` cards (up to 3 metric values, each verbatim in the edition, `E_METRICS`),
quiet status cards and cards carried from an earlier edition.

### 2.4 Never on a card

No URLs (`E_URL`), no markdown (`E_MARKDOWN`), no emoji (`E_EMOJI`), no citations (`E_CITATION`), no
images. Sources and citations belong in the web edition, and only there. Units follow the brief
(`units`: temperature in °C or °F, distance in km or mi). Terms in `no_gloss` are never explained,
and terms in `glossary` are always explained with the user's own gloss (in audio, not on the card).

### 2.5 Card ids

A card's id is `<date>-<slug>`, with `slug` in lowercase-kebab-case and unique in the edition
(`E_SLUG`). Pick slugs from the content ("cover", "tldr", "<entity>-<event>", "end"), so rebuilding
the same edition updates the same cards and never duplicates them.

## 3. The brief (the user's content)

### 3.1 Two layers

This guide is form; the brief is content. The brief is the user's, edited by them in the web app,
never by you. You read it with `get_user_brief`, follow it, and record its `brief_version` in the
bundle. If the brief changes during a build, publishing is refused (`E_BRIEF_STALE`): fetch it again
and rebuild.

### 3.2 Brief config schema

```json
{
  "title": "string",
  "tldr": true,
  "total_card_budget": 12,
  "total_audio_budget_sec": 1200,
  "language": "en",
  "units": { "temperature": "C", "distance": "km" },
  "glossary": [{ "term": "string", "gloss": "string" }],
  "no_gloss": ["string"],
  "delivery": { "time": "07:00", "timezone": "America/Los_Angeles", "days": ["mon", "tue", "wed", "thu", "fri"] },
  "sections": [
    {
      "id": "kebab-case-id",
      "title": "Shown in the kicker",
      "template": "status | discovery | metric | agenda | note",
      "source": {
        "kind": "web_news | rss | finance | calendar | feed",
        "entities": ["what this adapter tracks"],
        "query": "a search query or filter",
        "urls": ["feed URLs, for rss/feed"]
      },
      "instructions": "free text: what counts, how to rank, what a quiet day looks like",
      "max_cards": 3,
      "quiet_behavior": "show_status | omit | show_last",
      "audio": { "glance": true, "deep_dive": "required | on_alert | never" }
    }
  ]
}
```

- `source.kind` names the adapter you gather with: `web_news` (web search for news), `rss`
  (the listed feeds), `finance` (quotes and figures for the listed entities), `calendar` (the
  user's events), `feed` (any other structured feed in `urls`). Stay within the adapter.
- `instructions` is free text and it governs the section: which items count, ranking, and how
  honest to be on a quiet day. Follow it over your own taste.
- `delivery` is when the edition must be ready; build it before then.

### 3.3 Budgets and overflow

`max_cards` and `total_card_budget` are **ceilings, never quotas**: never pad a quiet section to
reach them (`E_MAX_CARDS`, `E_CARD_BUDGET`). Cover, TL;DR and End count toward the total. Audio
counts toward `total_audio_budget_sec` (`E_AUDIO_BUDGET`).

When there is more than fits, cut by section order: **later sections lose cards first**. List each
cut item in the bundle's `cut` (`{ section_id, slug?, reason }`) so it's logged, never silent. An
**alert** (`alert: true` on a status card the user asked to be alerted on, see §4.2) is never cut
(`E_ALERT_CUT`).

### 3.4 Quiet days

Each section's `quiet_behavior` says what a day with nothing worth a card looks like:

- `show_status`: one status card saying so, with `quiet: true` (no key number needed), e.g.
  "No change today". A section with no cards and no `cut` entry fails `E_QUIET`.
- `omit`: leave the section out entirely (no quiet card).
- `show_last`: repeat the last edition's card for that section, with `carried_from: "<date>"`.

## 4. The edition

### 4.1 Full edition first

Write the **full web edition** first: for each brief section, the complete text (`body`), a
`methodology` part (what it is → how it works and what's new, with numbers → why it matters) where
there's a deep dive, and `sources` (title + URL). Citations live here. An `intro` section may open it.
Then derive the cards from the finished edition (`E_EDITION_EMPTY` if there's no edition text).

### 4.2 Structure

```
Cover → [alert cards] → [TL;DR] → section cards in brief section order → End
```

- **Cover** (`kind: "cover"`, first, `E_COVER`): the title is the edition's name; the body is
  one line about the day.
- **Alerts**: status cards with `alert: true` go right after the Cover, ahead of the TL;DR
  (`E_ORDER`).
- **TL;DR** (`kind: "tldr"`) is there iff the brief says `tldr: true` (`E_TLDR`): the one thing to
  know today, with its key number.
- **Section cards** (`kind: "section"`, `section_id`, `template` = the section's, `E_TEMPLATE`) in
  the brief's section order (`E_ORDER`).
- **End** (`kind: "end"`, last, `E_END`): a short sign-off; the footer is rendered for you (it
  points to the past editions, which open when the reader swipes up past the End).

### 4.3 Template registry

You may not invent layouts. A section names one template; new kinds are added to this guide, not
improvised in an edition.

| Template | For | Card |
|---|---|---|
| `status` | a tracked entity changed or didn't | title: entity + change; body: what it means; key number: the change |
| `discovery` | ranked new items | title: who did what; body: why it matters; method keyword (required) |
| `metric` | numbers to watch | title; 1–3 metric lines (label + value); body: the one driver |
| `agenda` | time-ordered items | title: the next or most important item, with its time as the key number |
| `note` | a single free item | title + body |

## 5. Audio

Cards and audio are one bundle. Every card whose section asks for it gets glance audio, a deep
dive, or both (`E_GLANCE_REQUIRED`, `E_DEEP_DIVE_REQUIRED`, `E_DEEP_DIVE_FORBIDDEN`):

- `audio.glance: true`: every card in the section has a glance.
- `audio.deep_dive: "required"`: every non-quiet card has one; `"on_alert"`: alert cards only;
  `"never"`: none.

Card *i*'s audio belongs to card *i* only (its files are named after the card's slug).

### 5.1 Glance audio

At most 75 words (~30 seconds, `E_GLANCE_WORDS`). Not a read-aloud of the card (`W_READ_ALOUD`):
say what the card can't, such as the context, who it affects, or whether the deep dive is worth it.

### 5.2 Deep dive

450–750 words (3–5 minutes, `E_DEEP_DIVE_WORDS`), built from the edition's `methodology`: what it is
→ how it works and what's novel, with numbers → why it matters. Podcast register: one voice talking
to one listener, with no "in this episode" filler.

### 5.3 Written to be spoken

- Numbers as spoken where they'd be ambiguous: "twenty-six billion dollars", not "$26B"
  (`E_SCRIPT_NUMBER`).
- No URLs or citations in spoken text (`E_SCRIPT_URL`, `E_SCRIPT_CITATION`).
- Letter-space acronyms only when they'd otherwise be misread.
- Use the brief's `language`, `units`, `glossary` and `no_gloss`.

### 5.4 Making and uploading audio

You produce the audio yourself (your own voice output or whatever TTS you have), so the voice
matches what you wrote. MP3 is preferred (also m4a/aac, wav, ogg/opus). For each file:

1. `create_audio_upload({ date, slug, kind: "glance" | "deep_dive", content_type })` returns
   `path` and a short-lived `upload_url`. PUT the file's bytes to `upload_url` with that
   `Content-Type`. Small clips can go inline instead: pass `data_base64` (≤ 3 MB) and the file is
   stored in the same call.
2. Put the returned `path` (`<date>/<slug>-glance.mp3`, `<date>/<slug>-deep-dive.mp3`) and the
   real `duration_sec` into the card's `glance` / `deep_dive` with the `script`.

`publish_cards` checks that every referenced file was uploaded (`E_AUDIO_MISSING`, `E_AUDIO_PATH`).

## 6. Versions

A bundle carries `guide_version` (this guide's, above) and `brief_version` (from `get_user_brief`).
Either one being stale is an error (`E_GUIDE_STALE`, `E_BRIEF_STALE`): fetch again and rebuild,
never patch the numbers.

## 7. Validation

`validate_cards(bundle)` runs every rule above. It returns `errors` (they block publishing),
`warnings` (they don't), the rendered `frames`, an ASCII `snapshot` of the glasses preview and a
`preview_hash`. Fix every error and validate again. **Never publish over an error.**

| Code | Rule |
|---|---|
| `E_SHAPE`, `E_DATE` | bundle shape; date is `YYYY-MM-DD` |
| `E_GUIDE_STALE`, `E_BRIEF_STALE` | versions (§6) |
| `E_EDITION_EMPTY`, `E_UNKNOWN_SECTION` | full edition first; sections from the brief only (§4.1) |
| `E_COVER`, `E_END`, `E_TLDR`, `E_ORDER` | structure (§4.2) |
| `E_TEMPLATE` | the section's template (§4.3) |
| `E_SLUG` | ids (§2.5) |
| `E_LINES`, `E_LINE_WIDTH`, `E_CHARS` | form (§2.1) |
| `E_URL`, `E_MARKDOWN`, `E_EMOJI`, `E_CITATION` | never on a card (§2.4) |
| `E_KEY_NUMBER`, `E_KEY_NUMBER_EDITION`, `E_EXTRA_NUMBER`, `E_METRICS` | one key number (§2.3) |
| `E_METHOD_KEYWORD` | ≤ 4 words, on every discovery card (§2.2) |
| `E_CARD_BUDGET`, `E_AUDIO_BUDGET`, `E_MAX_CARDS`, `E_CUT`, `E_ALERT_CUT` | budgets (§3.3) |
| `E_QUIET` | quiet behaviour (§3.4) |
| `E_GLANCE_REQUIRED`, `E_DEEP_DIVE_REQUIRED`, `E_DEEP_DIVE_FORBIDDEN` | audio policy (§5) |
| `E_GLANCE_WORDS`, `E_DEEP_DIVE_WORDS`, `E_SCRIPT_NUMBER`, `E_SCRIPT_URL`, `E_SCRIPT_CITATION` | scripts (§5.1–5.3) |
| `E_AUDIO_SHAPE`, `E_AUDIO_PATH`, `E_AUDIO_MISSING` | audio files (§5.4) |
| `E_NO_PREVIEW` | publish without validating (and previewing) this exact bundle |

## 8. Build sequence

For each edition:

1. `get_card_authoring_guide` and `get_user_brief`. If either fails, stop: never build from memory
   or from yesterday's edition.
2. Research each section with its adapter and `instructions`, and write the full edition (§4.1).
3. Derive the cards from the finished edition (§2, §4.2).
4. Write the scripts and make the audio, then upload it (§5).
5. `validate_cards`. Fix and repeat until there are no errors.
6. Look at the returned `snapshot` (the glasses preview) and keep it in your run log.
7. `publish_cards` with the bundle and the `preview_hash` from the last validation of that exact
   bundle. Publishing again for the same date replaces that edition.

Never:

- start from a previous edition's cards as a template;
- copy rules from this guide into your prompt (fetch it);
- pad a quiet section up to `max_cards`;
- put depth on the glasses as more text: depth is audio.
