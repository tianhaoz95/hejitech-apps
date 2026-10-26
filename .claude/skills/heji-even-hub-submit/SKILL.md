---
name: heji-even-hub-submit
description: Get a HEJI project's Even G2 glasses plugin (.ehpk) through Even Hub review and published — the review rules the plugin's code must meet, the developer-portal forms field by field (name, tagline, icon format, category list, description, tags, screenshots, release notes), developer mode and Scan QR on the phone, Private/Beta/Public builds, and the listing kit to prepare in the project. Use when asked to "release to Even Hub", "submit the glasses app", "get it ready for Even Hub", "make the store icon", "what do I put in the Even Hub portal", "what category", "how do I test on my glasses", or when a project's glasses plugin (Wee Hours, G2 Digest, Headway, FitLoop, a new one) goes to the portal.
---

# Even Hub submission

Every glasses plugin in this repo (`projects/<name>/apps/glasses`, package `com.hejitech.<name>.glasses`)
reaches users through the Even Hub developer portal, <https://hub.evenrealities.com> (docs at
`/docs`; the rules below come from `docs/ship/app-submission`, `docs/build/page-lifecycle`,
`docs/build/design-guidelines`, `docs/test/*`). Each app is reviewed by hand; a rejection comes back
as notes in the portal. **Everything the portal asks is written down here, so the owner never has
to screenshot it again.** G2 Digest 0.2.0 (2026-10-26) went through this; its kit is the example:
`projects/g2digest/docs/even-hub/`.

## 1. The plugin must pass review (check the code first)

- **Double-tap on the root page calls `bridge.shutDownPageContainer(1)`** (the system exit dialog).
  Mode `0`, a custom confirm, or doing nothing is rejected. If double-tap already means something
  (stop audio), do that while it applies and exit otherwise, and add "Exit" to the contextual menu
  (G2 Digest: `packages/core/src/player.ts`, `packages/plugin/src/plugin.ts`). Confirming closes
  the phone WebView by itself; Conversate must open afterwards without a restart.
- **Never a black screen or a dead end.** First launch shows something that explains setup within
  seconds, and **every gesture gets a visible response on every screen**. Reviewers install with no
  account: if the app needs pairing or data, show a built-in demo/tour (G2 Digest:
  `packages/core/src/tour.ts`), not a static message that ignores the ring.
- **Phone locked, Even app in the background, 5 minutes:** still alive and responsive; single-shot
  work finishes. On Android the WebView may be suspended: treat resume as a cold start (state in
  bridge `setLocalStorage`, not memory).
- **No secrets in the `.ehpk`** (it can be unpacked); the only credential is a token the user pairs
  in. Every API the plugin calls answers CORS. The `app.json` network whitelist is a permission, not
  a CORS bypass, and must list every origin (no local addresses: the pack refuses them).
- **Every declared permission is used** (`network`, `g2-microphone`, `phone-microphone`, `location`,
  `album`, `camera`), each with a `desc` of 1–300 characters.
- **No links on the plugin's phone page**: a link navigates the Even app's WebView away from the
  plugin. Show addresses as selectable text.
- The SDK has **no audio output** to the glasses; phone audio (HTML `<audio>`) is the app's own.

**Layout on the glasses** (what owners notice first):
- The firmware font is **proportional and narrow** (4–18 px glyphs, 27 px line pitch): a
  25-character line covers ~40% of the 576 px width. Wrap by pixel widths, not characters.
  `node .claude/skills/heji-even-hub-submit/measure-font/measure.mjs` measures the font in the
  simulator and prints every glyph's width as JSON (the backtick isn't in the font at all).
  G2 Digest's table and pixel wrapping: `projects/g2digest/packages/core/src/font.ts`, `render.ts`.
- Other G2 apps draw a **bordered frame**: `borderWidth` 0–5, `borderColor` greyscale 0–15
  (13 is bright), `borderRadius` 0–10, `paddingLength` 0–32. With a 2 px border and 8 px padding,
  9 lines fit; leave ~20 px of width spare for real-glasses metrics. No trailing `\n` (scrollbar).
- **A second page** (e.g. a list): `createStartUpPageContainer` works once per session, so switch
  with `rebuildPageContainer` (it redraws everything and drops the menu unless passed again). List
  rows share the container's height (show ≤ 8, page the rest), and list clicks arrive as
  `listEvent` with `eventType` and the first row's `currentSelectItemIndex` left out (0). Double tap
  on a sub-page goes back; only the root page exits.
- No medical diagnosis, financial advice or emergency routing; no impersonation or keyword stuffing.

Manifest (`apps/glasses/app.json`): `package_id` reverse-domain, lowercase, no `-`/`_`; `edition`
`"202601"`; `name` ≤ 20 characters, no "Even", the same in the portal and on the glasses;
`version` from the release (`scripts/pack.mjs` stamps it); `min_sdk_version` set;
`supported_languages` set.

## 2. The project's listing kit

Keep it in `projects/<name>/docs/even-hub/` (committed; scan for anything unreleased first: the repo
is public):

- `LISTING.md`: every field below, ready to paste, plus the reviewer note.
- `icon-24.png`: from a 12 × 12 grid of `#`/`.` with
  `node .claude/skills/heji-even-hub-submit/make-icon.mjs grid.txt projects/<name>/docs/even-hub/icon-24.png`.
- `background-576x288.png`: greyscale only (no colour).
- `screenshots/*.png`: simulator exports, unpaired and paired (commands below).

**Never write backend coordinates** (the Supabase project ref, its `*.supabase.co` host) into the
kit, privacy pages or docs: `scripts/check_isolation.mjs` fails CI on them outside the project's
`backend.env` files. Say "our Supabase project's supabase.co address" instead.

The listing needs a **privacy policy** that covers every permission and names the backend
domains as the developer's, **terms and conditions**, and a **support URL** (G2 Digest:
`services/web/privacy/`, `services/web/terms/`, `services/web/support/`). Developer: HEJI TECHNOLOGY LLC, info@hejitech.com.

## 3. The portal, field by field

**Create a new project** (upload the `.ehpk` first):

| Field | Rule |
|---|---|
| App name * | ≤ 20 characters, filled from `app.json`. |
| App tagline * | **≤ 50 characters**. |
| App icon | "24 x 24 px monochrome PNG", upload or "Create with a tool". The validator accepts only **`#F4F4F4` at full opacity** and **fully transparent** pixels, and every lit pixel in a 2 × 2 block (single pixels and 1 px lines fail). An opaque black background fails with "Pixel 0,0 is neither #F4F4F4 at full opacity nor fully transparent. Export with anti-aliasing off." `make-icon.mjs` writes exactly that. |

**Edit description:**

| Field | Rule |
|---|---|
| Category * | One of: **AI** (contextual agents & LLM interfaces), **Lifestyle** (everyday integrations), **Productivity** (workspace, task management), **Health** (wellness and fitness trackers), **Entertainment** (quick play), **Education** (study aids, learning), **Music** (audio-focused tools), **Travel** (navigation and transit, the commute), **Utilities**. There is no News. |
| About * | ≤ 2000 characters. Say up front what account or setup it needs, so the tour isn't mistaken for a broken app. |
| Tags | Optional, ≤ 5, comma-separated, honest (no brand names, no stuffing). |

Picks so far: G2 Digest → Productivity (tags `news, briefing, audio, commute, ai`); Headway →
Travel; FitLoop → Health; Wee Hours → Lifestyle.

**Screenshots**: "Add screenshots"; they must match what the device renders, so use the simulator's
export (576 × 288 RGBA). **Background**: foreground and background must both be set, monochrome or
greyscale.

**Contact information** (shown publicly on the plugin's page): Developer name ≤ 25 → `HEJI
TECHNOLOGY LLC` (the legal publisher, as on every privacy policy and terms page; not the owner's
personal name); Contact email ≤ 50 → `info@hejitech.com` (the portal pre-fills the owner's personal
account email: replace it); Contact telephone ≤ 20 and Contact address ≤ 100 → only business ones, or
blank if the portal allows (never a home address: it's public).

**Access Permissions Required**: checkboxes Microphone of Even Smart Glasses, Location, Push
notifications, Local network, Bluetooth, Run background services, plus a free-text Other. Tick only
what `app.json` declares and the code uses: `g2-microphone` → Microphone of Even Smart Glasses,
`location` → Location. The portal lists the `.ehpk`'s `app.json` permissions on its own (a
Permissions section showing each `name` and `desc`, e.g. "Network · Fetch your editions and their
audio from G2 Digest"), so `network` needs no box and nothing in Other ("Local network" means the
LAN, not the internet). Leave Other empty unless the app uses something neither list covers. Don't tick Run background services for
WebView audio that merely keeps playing.

**Data collection**: checkboxes Location tracked and AI technology used, plus Other (a `+` adds
entries). Make it say exactly what the privacy policy says. Tick AI technology used whenever users
see AI-made content, even if the AI is the user's own agent rather than ours (G2 Digest: yes). Other
is rows of two fields, data type ("Eg. User ID") and purpose ("Eg. Used for identification"), one
row per `+`; **the purpose is cut at 50 characters** without warning. List each kind of data the
backend stores. G2 Digest's rows: Email address → Signing in to your account (Sign in with Google);
Brief → Telling your agent what to put in each edition; Editions and audio → Showing your cards and
playing their audio; Paired devices and tokens → Connecting your glasses, podcast app and agent.

**Third-party services (optional)**, the last step, then "Generate document": one text row per `+`
("Including links to third-party services"). List the providers the backend and plugin use, each
with its privacy link, under 50 characters to be safe: `Supabase (data, audio): supabase.com/privacy`,
`Cloudflare (API): cloudflare.com/privacypolicy`, `Google Sign-In: policies.google.com/privacy`
(add Apple, Stripe, etc. where a project uses them). The user's own agent isn't one: we don't
integrate it. Read the generated document before accepting it: it must agree with the project's
own privacy policy.

**Privacy and terms** ("Fill out privacy and terms"): the privacy policy and terms and conditions
(G2 Digest: `services/web/privacy/`, `services/web/terms/`; the terms say it isn't financial,
medical or news advice, which Even's content rules care about).

**Submit**: Confirm stays disabled until the listing has developer information, product screenshots,
permission information and the icon. New versions need a changelog: release notes 1–3 lines per
supported language. Builds move **Private → Beta → Public**; while `In Review` the tag locks
(**Cancel review** withdraws). Published versions are immutable and there's no rollback: a fix is a
new version from `scripts/cut_release.sh <project>`. The decision arrives as an email from
noreply@evenrealities.com ("You have an update on your Even Hub App Submission"); read the outcome in
the portal.

The `evenhub` CLI does the build side once the owner runs `! npx evenhub login`: `evenhub create
<file>.ehpk --name … --tagline …` (first time), `evenhub upload <file>.ehpk -m "what changed"`,
`evenhub promote <version> --to beta`, `evenhub testers add`, and `evenhub pack … --check` (is the
package ID free). Icon, background, screenshots and the final Submit are in the portal.

## 4. Testing on the owner's glasses

- **Developer mode has no toggle.** Sign in at <https://hub.evenrealities.com/login> with the account
  the Even app uses, force-quit the Even app (swipe it away) and reopen it: a developer section with
  **Scan QR** appears at the top right of the **Even Hub** tab.
- **QR (fastest):** `npm run dev -w @<name>/glasses` (serves on the LAN), then
  `npx evenhub qr --url http://<lan-ip>:<port>/` (`ipconfig getifaddr en0`); phone on the same
  Wi-Fi. The plugin talks to the production Worker unless the project's `?api=` override says
  otherwise. Dies when the phone locks.
- **Private build:** upload the `.ehpk`, then Even Hub → **Me → Apps → Private builds → Install**.
  Only the owner's account sees it; the glasses' own menu lists Beta and Public apps only.
- **Beta build:** what reviewers install, and the only one that survives a locked phone: run the
  §1 lock checks on it before submitting.

## 5. Screenshots from the simulator

```sh
npx evenhub-simulator --automation-port 9898 "<plugin URL>"      # unpaired: the first-run screen
curl -s -X POST 127.0.0.1:9898/api/input -H 'Content-Type: application/json' -d '{"action":"down"}'
#   actions: up, down, click, double_click, long_press, long_press_release, context_menu
curl -s -o shot.png 127.0.0.1:9898/api/screenshot/glasses       # 576 × 288 RGBA: upload as is
curl -s 127.0.0.1:9898/api/console                              # bridge events, errors
```

The PNG keeps the text in the alpha channel: composite on black to look at it, upload the original.
The simulator doesn't draw the system exit dialog (the screen just goes dark), so confirm that one
on the glasses.

## Order of work

1. Code meets §1 (tests for exit and first-run), CI green.
2. Kit in `docs/even-hub/` (§2), privacy and support pages live.
3. `scripts/cut_release.sh <project>` (the release attaches the `.ehpk`).
4. Owner: portal (§3), Beta install, lock test, Public → Submit.
5. Update this skill with anything the portal asked that isn't here yet.
