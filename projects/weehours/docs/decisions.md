# Decisions (v0)

The PRD ("Newborn Log — PRD") plus the changes agreed while planning, and the calls made during the overnight build. Each entry says why.

## Product

| Topic | Decision | Why |
|---|---|---|
| Name | **Wee Hours** (`com.hejitech.weehours`) | Built for the wee hours with a wee one. Short, warm, not clinical |
| App Store name | **Wee Hours: Hands-Free Baby Log** (30 chars, the limit); the home screen stays "Wee Hours" | The name drives search; "hands-free" is what sets it apart. The subtitle can carry "baby tracker" or "voice" |
| Platform | Native iOS + watchOS first; Android later | Siri, Action Button, widgets and Live Activities are what let the phone stand on its own |
| Tracking | A type registry; every category is optional (bottle, breast, pumping, solids, diaper, sleep, growth: weight, height, head size) | Support every family; fewer enabled options also make the model more accurate |
| Advice | The app records facts; MCP exposes them; the user's own agent interprets | No medical advice from us; no aggregation in the app beyond the status line |
| Pediatrician PDF | Dropped; raw CSV export instead | Aggregation is the agent's job |
| Billing | Monthly / yearly subscription and a lifetime purchase, per household, 14-day trial | As requested. **Judgment call:** tap logging stays free after the trial so parents never lose access to their own log |

## Architecture

| Topic | Decision | Why |
|---|---|---|
| Decision model | One unified model: **Laya** (0.4B ModernBERT, Q8 GGUF) via llama.cpp, on-device | Your choice. llama.cpp has decision models only in `llama-server`, so the decision path is ported to Swift (`ios/LayaRuntime`), with parity tested against the server |
| Question design | Event type = **category × phase**, not one 13-way question | Zero-shot Laya: 81% vs 13% type accuracy, and 0% vs 89% wrong auto-commits (`eval/results`) |
| Time and numbers | Clock times, relative times, ml/oz, kg/lb are parsed deterministically | The PRD already did this for clock times; Laya scored 21% on the "when" question |
| Calibration | Per-question temperature on top of Laya's own, fitted by `logeval --fit` | Thresholds only mean something if probabilities are calibrated |
| Sync | Supabase (Postgres + RLS), append-only events, an outbox plus a seq cursor | Android later; MCP needs server-side reads |
| Glasses voice | The glasses upload audio as a **capture**; a household phone processes it on open or on background refresh. Event id = f(capture id) | No server inference cost; all processing stays on the phone; two phones converge |
| Glasses gestures | Typed events go straight to Supabase (offline outbox); hold-to-speak attaches to the entry you just made | Time-critical facts (last feed) never wait for voice processing |
| Auth | Supabase Auth (Google, Apple, email for dev), shared by the app and MCP OAuth; personal access tokens for other agents | One identity everywhere |
| Local-only mode | "Use without an account" keeps the household on the phone (no Supabase); signing in later re-homes the never-synced rows and uploads them | The phone must stand alone; nothing is lost when moving to an account |
| Consistency | `spec/` is the single source; Swift and TypeScript run the same derivation fixtures | Prevents status drift between the phone, glasses and MCP |

## Monorepo (2026-10-15)

| Topic | Decision | Why |
|---|---|---|
| Home | Wee Hours moved into the HEJI monorepo (`tianhaoz95/hejitech-apps`, `projects/weehours`) with its history; the old repo is archived | Share one Supabase project (one plan's quota) and CI plumbing across the HEJI apps; easier to build an ecosystem |
| Database | Its own Postgres schema `weehours` and bucket `weehours` in the shared project, not `public` | Waypack predates the convention and owns `public` (it has its own `entitlements` table); accounts are shared, data isn't |
| MCP OAuth | The site's Cloudflare Worker is the OAuth server (`@cloudflare/workers-oauth-provider`, like Waypack); the MCP server moved from a Supabase Edge Function into that Worker | Owner's choice (a). Supabase's OAuth server has one consent URL per project, relative to the Site URL, which Waypack owns. A neutral shared consent router stays an option for later projects |
| Sign-up rows | Waypack's `on_auth_user_created` trigger is dropped; each app creates its rows on first use | Owner direction: one user pool for every app |
| Signing | TestFlight CI uses the team-wide HEJI identities Waypack uses (same certificates) | Owner direction; one set of secrets, never minting certificates |
| Google sign-in | The shared project's Google provider (HEJI web client) through Supabase in the system browser sheet with PKCE, returning to `weehours://login-callback`; the site uses the same provider | Owner request (2026-10-16). Reuses what Waypack set up, so no iOS OAuth client or GoogleSignIn SDK; Google shows the shared HEJI branding |
| Build numbers | Stay UTC timestamps | Builds already uploaded use them; Waypack's 2000 + run number would go backwards |

## Several children (2026-10-17)

| Topic | Decision | Why |
|---|---|---|
| Now screen | Direction 03 "Log-for bar" from `reports/archive/weehours-multi-child`: every shown child's status side by side, a sticky "Log for" bar over the buttons (any number of children, plus Both/All), foldable to one line; with one shown child, no bar and no extra card | Owner's pick, with: arbitrary child count, no wasted space for one child, fold for long stretches with one child |
| Which children a phone shows | Per phone (Settings → Children → Show on this iPhone); archiving is household-wide | Owner request: a family with three children can keep two on this phone |
| Per child | Name, birth date, colour, bottle size and quick-feed override; categories, reminders' intervals, caregivers, night window and duty stay household-wide | Recommended in the proposal; nothing else asked for |
| Several at once | One event per child sharing a `group` field; Undo takes them back together | Each child keeps a clean log; MCP and CSV need no new concept |
| Voice | Names in the sentence win ("the twins", "both of them" = all); otherwise the device's current child | Names are parsed deterministically, so the model's questions don't change |
| Price | Unchanged: one purchase covers every child | Recommended; families with twins shouldn't pay twice |

## Other voice languages (2026-10-20)

| Topic | Decision | Why |
|---|---|---|
| Approach | Spanish and Chinese are translated into English before the decision layer; Laya, the parsers, the keyword fallback and the eval stay English-only | Owner's pick over a multilingual model. English is untouched, so its quality can't regress |
| Switch | Settings → Voice → Language, per phone, English by default. English keeps the bundled `base.en`; any other language uses one multilingual Whisper (`openai_whisper-small_216MB`) | Each caregiver can speak their own language |
| Bundling | The multilingual model ships in the app next to `base.en` (0.8.1; ~210 MB more, ~785 MB installed), downloaded only by builds without it | Owner's call (2026-10-20): works offline right after install; well under the 4 GB limit |
| Translation | Whisper writes down what was said in that language, and Apple's on-device Translation (iOS 26, `TranslationSession(installedSource:)`) turns it into English; before iOS 26 or without the language downloaded, Whisper's own translate task | On a TTS spot check Whisper's translation lost key words ("pañal mojado" → "wet cloth", "尿布湿了" → "The urine is gone"); Apple's kept them ("Diaper, wet", "The diaper is wet") |
| Notes | Dictated shift notes stay in the spoken language | Notes are read by people, not the model |

## Before birth (2026-10-22)

| Topic | Decision | Why |
|---|---|---|
| Scope | A child can be added before birth with a due date; Now shows the gestational age and the movement tracker instead of the newborn buttons until "Baby has arrived" sets the birth date | Owner request: a tracker for a mother to follow her baby's movements in the belly |
| Tracking | Kick-count sessions (tap each movement, saved at ten with the minutes it took, or stopped early) plus single "Baby moved" taps; each tap in a count is also a movement entry | Owner's pick ("Kick-count sessions + single taps") |
| Data | Category `movement` (types `movement`, `kick_count`), `"model": false`; the due date is kept in the child's `babies.settings` (`due_date`), so no schema change | Voice prompts stay as the shipped model was trained; per-child extras already live in settings |
| Advice | No interpretation of counts; a fixed safety note says to contact the midwife or maternity unit straight away if movements slow or change | The app records facts, agents interpret (Agents); current guidance warns against waiting or relying on a fixed number |

## Photos on entries (2026-10-23)

| Topic | Decision | Why |
|---|---|---|
| Scope | Any number of photos per entry (tummy time, a bottle, a rash for the pediatrician), browsed later in Timeline → View → Photos | Owner request: evidence at the pediatrician, otherwise memories |
| Storage | Household cloud, resized: 2048 px JPEG (~0.1–0.5 MB) in the `weehours` bucket under `<household>/photos/<id>.jpg`; every household phone sees them; a copy is kept on the phone | Owner's pick ("Household cloud, resized") over full resolution (10× storage) and phone-only (partner wouldn't see them) |
| Data | A `photo` system entry per picture (`attached_to`, `path`, size, `taken_at`), so photos sync, merge and undo through the existing log; they follow the entry through edits; removing one is an undo plus deleting the file. No schema change: the bucket's household-folder policies already cover them | Reuses the offline outbox and sync; nothing new for graduation |
| Price | Adding needs the subscription (or trial); looking never does | Owner's pick ("Subscribers (and trial)") |
| Agents | MCP's `list_events` says how many photos an entry has; agents can't open or add photos | Owner's pick: baby photos don't go to an assistant's provider |
| Camera | Shots taken in the app are also saved, full size, to the iPhone's Photos library (add-only access) | Owner request: the camera roll should have the picture too |
| While it happens | Now shows a card for each ongoing feed, nap or timed activity with camera and library buttons that attach to it; the toast after logging offers the same | Owner request: catch the moment during the activity |

## Glasses release (2026-10-23)

| Topic | Decision | Why |
|---|---|---|
| Sign-in | The glasses pair with a 6-digit code from Settings → Even G2 glasses on the iPhone (10 minutes, single use, wrong codes throttled per address); the Worker trades it for a `glasses:<label>` access token, one per pair, revoked from the same screen | Owner asked to make the glasses release-ready: real accounts sign in with Apple or Google, so the prototype's email + password couldn't work, and typing a password on the Even app's page was never good |
| Transport | The glasses talk only to the Wee Hours Worker (`/api/glasses/*`, service key, household and author taken from the token), no longer to Supabase directly; this supersedes "typed events go straight to Supabase" above. Same outbox, same capture flow, same event ids | No Supabase coordinates or session in the plugin (graduation stays a Worker config change), and the Worker validates every entry with `@weehours/core` |
| Release | The plugin's version is the iPhone app's `MARKETING_VERSION`; `weehours-glasses-release.yml` attaches the `.ehpk` to each `weehours-v<version>` release; uploading to the Even Hub portal stays by hand | One version across surfaces, as `cut_release.sh` intends; the Even Hub portal has no upload API |
| Paywall | Pairing follows `Entitlement.allows(.glasses)` on the phone; paired glasses keep logging after a trial ends | Logging never stops working (Billing above) |

## Not done yet

See the report (`report/v0/site`, "What's verified") for what was verified in simulators and what still needs devices or the hosted project.
