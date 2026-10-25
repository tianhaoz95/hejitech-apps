# G2 Digest

A brief compiled ahead of time into glanceable cards for Even G2 glasses + R1 ring and audio for
headphones. Compile time (an agent, through MCP) does the research, writing, audio and validation;
runtime (the plugin) only plays a self-contained bundle. Layout: `README.md`. Why things are the way
they are: `docs/decisions.md` (read it before changing behaviour). Going live: `docs/DEPLOY.md`.

## Commands (from the repo root)

```sh
npm run test:g2digest            # core (render, every validator rule, brief, gestures) + plugin (Reader)
npm run typecheck:g2digest
npm run build:g2digest           # web (needs WEB_ALLOW_LOCAL=1 without production env) + glasses
node projects/g2digest/scripts/sync-guide.mjs          # after editing packages/core/guide/*.md
node projects/g2digest/scripts/check-no-topics.mjs     # PRD §13 grep test (CI)

# local stack: `supabase start` from the repo root (seed: reader@example.com / g2digest-dev)
echo "SUPABASE_SERVICE_ROLE_KEY=<local service key>" > projects/g2digest/services/web/.dev.vars
npm run dev:worker -w @g2digest/web                    # 127.0.0.1:8790, email sign-in for the seed account
node projects/g2digest/scripts/test-api.mjs            # integration (21 checks incl. OAuth, pairing, feed, delete)
npm run package -w @g2digest/glasses                   # build/g2digest.ehpk
npx evenhub-simulator --automation-port 9898 "http://127.0.0.1:8790/glasses/?pair=<code>"
```

Local tokens from the seed: agent `g2a_dev_local_token`, glasses `g2d_dev_local_device`, feed
`g2f_dev_local_feed`.

## Architecture

- **One render function** (`core/src/render.ts`): bundle → frames. The plugin, the web preview, the
  validator and the publish snapshot all use it; never format card text anywhere else.
- **One gesture state machine** (`core/src/player.ts`), driven by R1 events in the plugin and by
  on-screen buttons/keys in `<G2Preview>`, both through `plugin/src/reader.ts`.
- **Guide = form, brief = content.** `core/guide/card-authoring-guide.md` is served live by
  `get_card_authoring_guide`; bump `guide_version` in it when a rule changes (stale bundles are
  then refused), run `sync-guide.mjs`, and keep `validate.ts` and its per-rule tests in step. Topics
  live only in users' briefs: no topic, company or source names in code, guide or UI
  (`check-no-topics.mjs`).
- **Worker** (`services/web/src/worker`): `api.ts` (session / device token / pairing), `feed.ts`
  (podcast fallback), `mcp.ts` (six tools), `publish.ts` (validate + publish), `store.ts` (db,
  tokens, brief join). Service key only here. Clients read own rows via RLS; all writes go through
  the Worker.
- **Plugin** (`packages/plugin`): `detectBridge()` (Even WebView handler, 5 s), one full-screen
  text container, contextual menu as a second route to the deep dive, bridge local storage for the
  token / last bundle / position / audio mode, Cache Storage for audio.

## Pitfalls

- The Even SDK returns a bridge object in any browser: check `flutter_inappwebview` (as
  `detectBridge` does) before trusting it.
- `textContainerUpgrade` with just `content` replaces the whole text (verified in the simulator).
- Simulator screenshots are RGBA with the text in alpha: composite on black to look at them.
- Local Worker builds must not load `.env.production` (production Supabase): `dev:worker` builds
  with `--mode development`.
- Pairing is throttled per client address (KV `pairfail:<ip>`): locally everything is "local", so
  repeated wrong codes block local pairing for 10 minutes; tests send their own `CF-Connecting-IP`.
- The simulator isn't faithful for BLE lag, font metrics or container limits: a layout change
  isn't done until it's checked on the glasses.
- Even Hub review rules the plugin must keep (`docs/decisions.md` §Even Hub readiness): double-tap
  with nothing playing calls `shutDownPageContainer(1)` (never `0`, never a custom dialog); the glasses
  never show a dead end (no edition → the tour); no links on the phone page. Listing kit:
  `docs/even-hub/`.

## Releasing

`scripts/cut_release.sh g2digest --dry-run`, then for real. It bumps `apps/glasses/package.json`
(the plugin's version; `scripts/pack.mjs` stamps it into `app.json`) and publishes
`g2digest-v<version>`, whose workflow attaches the `.ehpk`. The Worker deploys on push to `main`.
