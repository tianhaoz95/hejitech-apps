# HQ

The repo's autopilot "CEO": scheduled agents find maintenance, reliability, performance and
opportunity work and propose it as evidence-backed **cards**; the owner approves, rejects or
discusses them in a web portal and an iPhone app; executors build approved cards on branches and a
second agent reviews them. Brand-new products stay with the owner. PRD:
`reports/2026-11-08-hq-prd` (serve its `script/serve.sh`). Decisions: `docs/decisions.md`.

HQ is **self-contained and portable**: it works on any repo that has `.hq/` folders, and its code
never names a project, a path or a repo tool (`scripts/check_coupling.mjs` enforces it). This
monorepo is its first customer.

## Layout

```
packages/core/      @hq/core: the three contracts in code: card schema + lifecycle (card.ts),
                    HQ.md policy merge, tiers, verb checks, budget, schedules (policy.ts),
                    get_context (context.ts). Shared by the Worker and the CLI.
services/web/       @hq/web: Cloudflare Worker (D1 store, R2 files, KV for OAuth, hourly cron)
  src/worker/       store.ts (every rule enforced here), api.ts (portal/iOS/runner),
                    mcp.ts (agents), index.ts (OAuth 2.1 for MCP, tokens, cron)
  src/main.ts       the owner's portal (inbox, card, health, runs, settings), vanilla TS
  migrations/       D1 schema
apps/cli/           @hq/cli: `hq lint | policy | sync | context | verb | runner | init`
  src/runner.ts     claims runs and does them; adapters.ts starts agents; prompts.ts writes
                    every launch prompt (context included)
  test/fixture/     a repo HQ has never seen (portability tests)
apps/ios/           SwiftUI app (XcodeGen): inbox, card, health, runs, settings
scripts/            test-api.mjs (Worker integration, CI), check_coupling.mjs
.hq/                HQ as a managed project of this repo (like every other project)
```

The repo side lives outside this folder: the root `.hq/` (repo policy, `lib/` helpers for verbs)
and `projects/<name>/.hq/` per project.

## Commands

```sh
npm run typecheck:hq && npm run test:hq && npm run build:hq
node projects/hq/scripts/check_coupling.mjs
npm run -s hq -- lint                    # every .hq/ in the repo (add --no-run to skip dry runs)
npm run -s hq -- verb tradeboard health  # run a verb as the runner would

# Local Worker on 127.0.0.1:8799 (D1/R2/KV local, state in services/web/.wrangler)
echo "HQ_OWNER_TOKEN=$(openssl rand -hex 24)" > projects/hq/services/web/.dev.vars
npm run dev:worker -w @hq/web
HQ_URL=http://127.0.0.1:8799 HQ_OWNER_TOKEN=… node projects/hq/scripts/test-api.mjs   # on a fresh D1

# A runner on this Mac (tokens from the portal's Settings)
HQ_URL=… HQ_TOKEN=hq_run_… HQ_AGENT_TOKEN=hq_agt_… HQ_DENY_TOOLS='Bash(*cut_release.sh*)' \
  npm run -s hq -- runner            # --once to drain the queue and exit
```

iOS: `cd apps/ios && xcodegen generate`, then build the `App` scheme. Debug launch arguments
`-serverURL <url> -ownerToken <token> -screen inbox|health|runs|settings|card:<id>` reach any
screen without taps.

## How it works

- **Cards** (`packages/core/src/card.ts`): `create_proposal` refuses a card without evidence, a
  plan or a verify step, with a tier more autonomous than the project's ceiling, or for an unknown
  project/verb. L0 cards are approved by policy and queue a build at once.
- **Tiers**: L0 just do it · L1 build, then ask · L2 ask, then build · L3 never autonomous. A
  project's `tier_ceiling` can only be stricter than the root's. `policy` cards are always L3.
- **Verbs** (`.hq/bin/<verb>`): JSON on stdout, meaningful exit code, `--dry-run` for anything with
  side effects. L0 verbs run; L1/L2 need an approved card; L3 only the owner starts. The server
  checks (`checkVerb`), and the runner re-checks against its own checkout.
- **Runs**: the cron (and owner) enqueue scout, ceo and health runs; approvals enqueue builds;
  finished builds enqueue reviews; owner comments enqueue replies. Runners claim them
  (`/api/runs/claim`), respecting the kill switch, the weekly budget (scouts/CEO only), WIP per
  project and the open-PR limit.
- **Credentials**: only the runner holds them. Agents it starts get an agent token for the MCP
  server and a deny-list (no push, merge, release, deploy, secrets; `HQ_DENY_TOOLS` adds repo-
  specific ones). Agents can't approve, change policy, pause HQ or see tokens.
- **Entry point**: `get_context` (MCP) / `GET /api/context`: merged HQ.md policy + live state
  (open cards, recent decisions = learned taste, budget left). Reached by the launch prompt, the
  MCP server's instructions and the pointer in the root `AGENTS.md`.

## Pitfalls

- **Node runs the CLI's TypeScript directly** (type stripping): no parameter properties, enums or
  namespaces in `apps/cli/src` or `packages/core/src` (`erasableSyntaxOnly` in the CLI tsconfig).
- **OAuth wants an HTTPS `PUBLIC_URL`** (loopback HTTP is the exception), and agent tokens are
  bound to it as their audience: a Worker served on another host/port needs `--var PUBLIC_URL:…`
  matching the URL agents call, or MCP answers `invalid_token`.
- **iOS ATS**: plain HTTP is allowed only for local names and `*.ts.net`; a raw Tailscale IP is
  refused. Use the MagicDNS name for a dev Worker.
- **Device builds from a non-interactive shell** fail at codesign with `errSecInternalComponent`
  (the keychain asks a person); build to the iPhone from Xcode or a logged-in terminal once.
- Verb runs dedupe by arguments: a real run must never merge into a queued dry run (fixed; tested).

## Releasing

`scripts/cut_release.sh hq` bumps `MARKETING_VERSION` in `apps/ios/project.yml` (refusing until
`WhatsNewView.swift` describes the version) and publishes `hq-v<version>`. No TestFlight workflow
yet; the Worker deploys on push once Workers Builds is linked (`docs/DEPLOY.md`).
