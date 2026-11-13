# HQ

A repo's autopilot "CEO", as a product teams sign up for: scheduled agents find maintenance,
reliability, performance and opportunity work and propose it as evidence-backed **cards**; the
team approves, rejects or discusses them in a web portal and an iPhone app; executors build
approved cards on branches and a second agent reviews them. Brand-new products stay with people.
PRD: `reports/2026-11-08-hq-prd` (v2: §10 workspaces). Decisions: `docs/decisions.md`.

**A workspace is one repository and the people who work on it** (HQ is built for monorepos).
Members sign in through the shared Supabase project and have a role: **admin** (members, invites,
tokens, kill switch, policy), **approver** (approve, reject, ship, run any verb), **viewer** (read,
comment). Runners and agents use workspace tokens; each workspace runs its own runners.

HQ is **self-contained and portable**: it works on any repo that has `.hq/` folders, and its code
never names a project, a path or a repo tool (`scripts/check_coupling.mjs` enforces it). This
monorepo is its first customer.

## Layout

```
packages/core/      @hq/core: the contracts in code: card schema + lifecycle (card.ts), on-demand
                    requests (request.ts), the safe markdown renderer and figure frame (markdown.ts),
                    HQ.md policy merge, tiers, verb checks, budget, schedules (policy.ts),
                    get_context (context.ts), who may do what (roles.ts), the scout and CEO tasks and
                    the sweep's instructions (sweep.ts). Shared by the Worker and the CLI.
services/web/       @hq/web: Cloudflare Worker (KV for OAuth, hourly cron) on the shared Supabase
                    project (schema `hq`, bucket `hq`; supabase/schemas/hq/schema.sql)
  src/worker/       store.ts (every rule, workspace scoping and role check), api.ts (people:
                    /api/me, /api/workspaces, /api/w/<id>/…; tokens: /api/…), mcp.ts (agents),
                    index.ts (OAuth 2.1 for MCP with a workspace picker, tokens, cron)
  src/main.ts       the portal (sign-in, workspace switcher, inbox with the Ask box, card, requests, health, runs, settings
                    with members and invites), vanilla TS + supabase-js
apps/cli/           @hejitech/hq (published to npm and GitHub Packages): `hq login | logout | lint | policy | sync | context | verb | runner | init`
  src/credentials.ts  where the address and tokens come from (environment, then the saved login);
                    login.ts is `hq login` (prompts, browser approval or a pasted token)
  src/runner.ts     claims runs and does them; adapters.ts starts agents; prompts.ts writes
                    every launch prompt (context included)
  test/fixture/     a repo HQ has never seen (portability tests)
apps/ios/           SwiftUI app (XcodeGen): sign-in (Google PKCE, Apple, Debug email),
                    workspace setup/switch, inbox, card, requests (Ask HQ), health, runs, settings
                    with members; Markdown.swift mirrors the portal's markdown and figure frame
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

# Local: `supabase start` (repo root), then the Worker on 127.0.0.1:8799 with email sign-in
echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o json | jq -r .SERVICE_ROLE_KEY)" > projects/hq/services/web/.dev.vars
npm run dev:worker -w @hq/web
node projects/hq/scripts/test-api.mjs     # 28 steps: two teams, roles, isolation, the whole loop

# Sign in once per machine (asks for the address, then the browser or a pasted token), then sync
npm run -s hq -- login && npm run -s hq -- sync

# A runner on this Mac (after `hq login`; headless: HQ_URL=… HQ_TOKEN=hq_run_… HQ_AGENT_TOKEN=hq_agt_…)
HQ_DENY_TOOLS='Bash(*cut_release.sh*)' npm run -s hq -- runner     # --once to drain the queue and exit
```

iOS: `cd apps/ios && xcodegen generate`, then build the `App` scheme. Debug builds use the local
stack; launch arguments `-signInEmail <e> -signInPassword <p> -screen inbox|requests|health|runs|settings|card:<id>|request:<id>` (and `-hq.workspace <id>` to pick the workspace)
reach any screen without taps (`-production` for the hosted HQ, `-serverURL` for another Worker).

## How it works

- **Cards** (`packages/core/src/card.ts`): `create_proposal` refuses a card without evidence, a
  plan or a verify step, with a tier more autonomous than the project's ceiling, or for an unknown
  project/verb. L0 cards are approved by policy and queue a build at once.
- **Card text** is markdown (`why`, `plan`, `verify`, comments, request threads); drawings are
  `figures` (static HTML/CSS/SVG) placed with `![title](figure:<id>)` and shown in a sandboxed frame
  with no scripts and no network. Only `markdown.ts`'s output goes into `innerHTML`; never render
  agent text any other way. The portal sends a CSP (`services/web/public/_headers`).
- **Requests** (`packages/core/src/request.ts`): admins and approvers ask in their own words; that
  queues a `request` run, and open requests appear in every agent's `get_context`. An agent
  `claim_request`s (a 30-minute lease), files cards with `request_id`, then `answer_request`s
  (proposed, question, declined, note). Asking approves nothing. Requested cards skip the inbox cap.
- **Tiers**: L0 just do it · L1 build, then ask · L2 ask, then build · L3 never autonomous. A
  project's `tier_ceiling` can only be stricter than the root's. `policy` cards are always L3.
- **Verbs** (`.hq/bin/<verb>`): JSON on stdout, meaningful exit code, `--dry-run` for anything with
  side effects. L0 verbs run; L1/L2 need an approved card; L3 only the owner starts. The server
  checks (`checkVerb`), and the runner re-checks against its own checkout.
- **Runs**: the cron (and owner) enqueue scout, ceo and health runs; approvals enqueue builds;
  finished builds enqueue reviews; owner comments enqueue replies. Runners claim them
  (`/api/runs/claim`), respecting the kill switch, the weekly budget (scouts/CEO only), WIP per
  project and the open-PR limit.
- **Sweeps** (`start_sweep` / `finish_sweep` on MCP, `sweep.ts` + `startSweep` in store.ts): any
  connected agent does the routine work in its own session, no runner: "do a sweep for HQ", the
  `sweep` MCP prompt, or a scheduled task in the Claude app. `start_sweep` turns the due scouts (a
  scout the cron queued counts as due; `scouts` names some, `force` runs all) and the CEO, when due
  and the sweep covers everything, into runs the caller holds (`running`, runner `sweep:<name>`), so
  runners skip them and schedule and budget count them; it returns the steps (open requests first,
  then each scout's task, the CEO, then `finish_sweep`) with the repo context. Only that caller can
  close them; unclosed ones fail after 6 hours. Refused while paused or over budget. Scout and CEO
  text lives in `@hq/core`, so the runner's launch prompts and a sweep say the same thing. A sweep
  has no deny-list: it's told to stay read only, and the server's tier and approval checks still
  hold.
- **Workspaces**: every row has a `workspace_id`; people need a role in it (`memberRole`), tokens
  belong to one. RLS lets members read their workspaces' rows directly; every write goes through the
  Worker. A synced policy must name the workspace's repo. Invites are single-use, expiring codes.
- **Credentials**: only the runner holds them. Agents it starts get an agent token for the MCP
  server and a deny-list (no push, merge, release, deploy, secrets; `HQ_DENY_TOOLS` adds repo-
  specific ones). Agents can't approve, change policy, pause HQ or see tokens.
- **Signing the CLI in** (`apps/cli/src/credentials.ts`, `login.ts`): commands that talk to HQ use
  `HQ_URL` + `HQ_TOKEN` (+ `HQ_AGENT_TOKEN`) when set, else the login saved for the repo
  (`~/.config/hq/credentials.json`, mode 600, keyed by `repo:`), else they start `hq login` when there
  is a terminal and fail with instructions when there isn't. Browser sign-in is a device-style
  exchange: the CLI makes a secret and opens `/cli/login/` with its hash; an admin allows it
  (`POST /api/w/<id>/cli-logins`, kept in KV for ten minutes); the CLI polls
  `POST /api/cli-login/claim` with the secret and gets a runner and an agent token, minted then, once.
- **Entry point**: `get_context` (MCP) / `GET /api/w/<id>/context`: merged HQ.md policy + live state
  (open cards, recent decisions = learned taste, budget left). Reached by the launch prompt, the
  MCP server's instructions and the pointer in the root `AGENTS.md`.

## Pitfalls

- **Node runs the CLI's TypeScript directly** in a checkout (type stripping): no parameter
  properties, enums or namespaces in `apps/cli/src` or `packages/core/src` (`erasableSyntaxOnly` in
  the CLI tsconfig). `bin/hq.mjs` runs `src/` when it exists and the bundle otherwise, so a stale
  local `dist/` never shadows the source. `@hq/core` stays private: it is bundled, never published.
- **Exposing the `hq` schema locally needs a restart** of the stack after `config.toml` changes;
  don't use `alter role authenticator set pgrst.db_schemas` (it silently overrides config.toml for
  every project).
- **The runner's HTTP client retries once** on a network error: a kept-alive connection can close
  while a verb or agent runs.
- **OAuth wants an HTTPS `PUBLIC_URL`** (loopback HTTP is the exception), and OAuth access tokens
  are bound to it. HQ's own `hq_agt_`/`hq_run_` tokens skip the OAuth layer on `/mcp`
  (`ownTokenMcp` in `src/worker/index.ts`), so runners and agents work at any address.
- **iOS ATS**: plain HTTP is allowed only for local names and `*.ts.net`; a raw Tailscale IP is
  refused. Use the MagicDNS name for a dev Worker.
- **Device builds from a non-interactive shell** fail at codesign with `errSecInternalComponent`
  (the keychain asks a person); build to the iPhone from Xcode or a logged-in terminal once.
- **Fresh build worktrees** get the repo-wide `setup` verb (here `npm ci`) before the agent starts.
- Verb runs dedupe by arguments: a real run must never merge into a queued dry run (fixed; tested).

## Releasing

`scripts/cut_release.sh hq` bumps `MARKETING_VERSION` in `apps/ios/project.yml` (refusing until
`WhatsNewView.swift` describes the version) and publishes `hq-v<version>`, which runs
`hq-testflight.yml` (`scripts/release_testflight.sh`, then `asc_build_status.swift` waits for
Apple's verdict) and `hq-cli-release.yml`, which packs the `hq` command once with the release's
version (`npm run build -w @hejitech/hq` bundles `@hq/core` and js-yaml into `dist/hq.mjs`, so the
package has no dependencies and runs on Node 20), checks the tarball on Node 20 and publishes it as
`@hejitech/hq` to npm (provenance, with the repo's shared npm token `NPM_TOKEN`) and as
`@<repo owner>/hq` to GitHub Packages (the workflow's own token). Run it by hand without a tag to
rehearse from a branch; it publishes nothing. Setup: `docs/DEPLOY.md` §7. The Worker deploys on push once Workers Builds is linked (`docs/DEPLOY.md`).
App Store steps and copy: `docs/app-store.md`.
