# Decisions (v0)

The PRD ("Newborn Log — PRD") plus the changes agreed while planning, and the calls made during the overnight build. Each entry says why.

## Product

| Topic | Decision | Why |
|---|---|---|
| Name | **Wee Hours** (`com.hejitech.weehours`) | Built for the wee hours with a wee one. Short, warm, not clinical |
| Platform | Native iOS + watchOS first; Android later | Siri, Action Button, widgets and Live Activities are what let the phone stand on its own |
| Tracking | A type registry; every category is optional (bottle, breast, pumping, solids, diaper, sleep, weight) | Support every family; fewer enabled options also make the model more accurate |
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
| Consistency | `spec/` is the single source; Swift and TypeScript run the same derivation fixtures | Prevents status drift between the phone, glasses and MCP |

## Not done yet

See the report (`report/v0/site`, "What's verified") for what was verified in simulators and what still needs devices or the hosted project.
