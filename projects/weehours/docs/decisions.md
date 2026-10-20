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

## Not done yet

See the report (`report/v0/site`, "What's verified") for what was verified in simulators and what still needs devices or the hosted project.
