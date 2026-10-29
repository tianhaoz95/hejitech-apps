# FitLoop

The user's own AI agent (any MCP client) writes a fitness and nutrition plan; FitLoop shows it on
iPhone, Apple Watch, the web and Even G2 + R1, takes check-ins and in-the-moment feedback, and hands
everything back to the agent over MCP. FitLoop gives no advice of its own. Layout: `README.md`. Why
things are the way they are: `docs/decisions.md` (read it before changing behaviour). Going live:
`docs/DEPLOY.md`. Read the root `CLAUDE.md` too.

## Commands (from the repo root)

```sh
npm run test:fitloop && npm run typecheck:fitloop     # core (validator, day state, settings, glasses) + plugin
npm run build:fitloop                                 # web (WEB_ALLOW_LOCAL=1 without production env) + glasses

# local stack: `supabase start` from the repo root (seed: athlete@example.com / fitloop-dev, plan v1)
echo "SUPABASE_SERVICE_ROLE_KEY=<local service key>" > projects/fitloop/services/web/.dev.vars
npm run dev:worker -w @fitloop/web                    # 127.0.0.1:8794, email sign-in for the seed account
node projects/fitloop/scripts/test-api.mjs            # integration (19 checks: MCP loop, check-ins, feedback, switches, OAuth, RLS)
projects/fitloop/scripts/glasses-sim.sh [--e2e]       # the plugin in the Even Hub simulator (DATE=YYYY-MM-DD, DEBUG_CONSOLE=1)
npm run package -w @fitloop/glasses                   # apps/glasses/build/fitloop.ehpk (version = MARKETING_VERSION)

cd projects/fitloop/apps/ios/FitLoopKit && swift test # models vs real Worker JSON, reminders planner
cd projects/fitloop/apps/ios && xcodegen generate     # FitLoop.xcodeproj is generated and git-ignored
xcodebuild -project FitLoop.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' -derivedDataPath .derived CODE_SIGN_IDENTITY=- build
```

Local tokens from the seed: glasses `fld_dev_local_device`, agent `fla_dev_local_token` (MCP at
`http://127.0.0.1:8794/mcp`). App Review demo account: locally `review@example.com` /
`fitloop-review-dev` (wrangler.jsonc vars); production via `scripts/review_account.sh fitloop`
(`review.env`, skill heji-review-account). iPhone launch arguments (Debug): `-autoSignIn` (seed athlete on the
local stack), `-reviewSignIn` (the App Review sign-in path), `-screen today|plan|progress|feedback|settings`, `-date YYYY-MM-DD`, `-openWorkout`
(the day's first workout in the player), `-noHealth` (no Health sheet), `-production`.

## Architecture

- **`@fitloop/core` is the one engine** (`packages/core/src`): `types.ts` (plan format 1, check-ins,
  feedback, vitals, settings), `validate.ts` (every plan rule; `LIMITS` keep text G2-sized),
  `plan.ts` (day for a date, `dayState`/`dayStateOf`, `adherence`), `settings.ts` (defaults,
  `normalizeSettings`, checks for settings / check-ins / feedback / vitals), `guide.ts` (what
  `get_plan_guide` serves; bump `GUIDE_VERSION` with a rule change), `glasses.ts` (screens laid out
  in pixels by `font.ts`, 9 lines in a bordered frame, and the R1 `Navigator`). Change behaviour there, with a test.
- **Worker** (`services/web/src/worker`): `api.ts` (session / glasses token / pairing; every write
  checked with core), `review.ts` (App Review's demo account: `/api/review-sign-in` resets it to
  core's `demoPlan` / `demoSettings` and mints a Supabase session), `mcp.ts` (13 tools, each with annotations; `agent_access` switches enforced
  here), `store.ts` (db, tokens, plan versions, `today()`), `index.ts` (OAuth provider). Service key
  only here; clients read their own rows through RLS.
- **Plugin** (`apps/glasses/src`): `app.ts` (FitLoopApp: today from the Worker with a cached copy,
  optimistic check-ins + offline queue, live HR polling during a workout, pairing; tested with
  fakes) and `main.ts` (bridge, one text container, R1 events, the phone page).
- **iPhone** (`apps/ios/App`): `AppModel` (phase, `route()` ends every sign-in path, refresh,
  check-ins, reminders via `ReminderPlanner`, Health sync, the Watch link), Today (workouts open
  the `WorkoutPlayer`; meals check off), Plan, Progress, Feedback, Settings (every switch, about you,
  glasses pairing). `Services.swift`: `HealthSync` (daily summary) and `WatchLink` (WCSession).
- **Watch** (`apps/ios/Watch`): runs the `HKWorkoutSession` when the phone opens a workout
  (`startWatchApp`), sends heart rate every 4 s and "set done", shows the set and rest timer.
  The phone sends today's progress as user info (`DayProgress`); the watch keeps it in a Keychain item
  shared with the `WatchWidgets` complication (`keychain-access-groups`, no App Group: CI's API key
  can't register one) and reloads it. Tapping the complication opens the watch app.

## Exercise demonstration media & procedural rigging

FitLoop hosts and serves exercise demonstration GIFs at `/api/exercises/<slug>.gif` with CORS headers (`Access-Control-Allow-Origin: *`) and long-lived cache headers (`Cache-Control: public, max-age=31536000, immutable`), consumed by iOS, the web app, and Even G2 glasses.

- **Storage & On-Demand Caching**: Cached in Supabase Storage (`fitloop` bucket) under `exercises/<slug>.gif`. When an exercise GIF is requested that is not yet cached, the Worker automatically resolves it from the 1,300+ item exercise catalog or procedural rigging presets, uploads it to Supabase Storage, and streams it back.
- **Open-source upstream datasets**:
  - `hasaneyldrm/exercises-dataset` (MIT License): 1,324 exercises mapped by slug and ID.
  - `omercotkd/exercises-gifs` (MIT / Open Dataset backup): 4-digit ID mapped GIF assets.
- **Procedural Rigging Engine** (`@fitloop/core`): Pure TypeScript parametric 2D skeletal animation engine using `omggif`. Renders rounded capsule limbs with depth layering and smooth sinusoidal motion cycles. Presets include `cat-cow`, `bird-dog`, `childs-pose`, `kneeling-hip-flexor`, and `basketball`.
- **MCP tools**: `upload_exercise_gif` (upload custom or auto-cache) and `render_exercise_animation` (procedural generation).

## Pitfalls

- Dates are the client's local `YYYY-MM-DD` (`/api/today?date=`); the agent's "today" comes from
  `settings.timezone`, which the iPhone keeps in step with the phone.
- Glasses timers step by 5 s above 10 s (`clockText`): per-second Bluetooth updates queue up and
  delay everything else on the display.
- The Even simulator keeps running after `glasses-sim.sh` exits if it was started by an earlier run
  (port 9900 in use): `pkill -f evenhub-simulator`. Vite caches pre-bundled core code in
  `node_modules/.vite`: clear it if the plugin shows old text.
- PostgREST only sees `fitloop` after a stack restart once it's in `config.toml`.
- `.env.production` is git-ignored at the root: it's force-added (`git add -f`).
- An unsigned simulator build can't use the Keychain: build with `CODE_SIGN_IDENTITY=-`.
- No "Apple" in App Intent strings if intents are added (root CLAUDE.md).
- Even Hub review rules the plugin keeps (`heji-even-hub-submit` skill, `docs/decisions.md`): double
  tap on Today (the root page) sends `exit` → `shutDownPageContainer(1)`; menus live on a hold;
  unpaired it plays a demo day (`demoDay` in `apps/glasses/src/app.ts`, nothing sent); every gesture
  answers. Listing kit: `docs/even-hub/`.

## Releasing

**What's New** (`apps/ios/App/Sources/WhatsNewView.swift`): every release prepends its notes and
sets `currentVersion`; `release.env`'s `release_check` refuses a version it doesn't describe.
`scripts/cut_release.sh fitloop --dry-run`, then for real: it bumps `MARKETING_VERSION`, pushes
(Cloudflare deploys the Worker) and publishes `fitloop-v<version>` → `fitloop-testflight.yml`
(iPhone + Watch) and `fitloop-glasses-release.yml` (attaches the `.ehpk`, uploads it to Even Hub and promotes it to Beta; submit for review in the portal).
