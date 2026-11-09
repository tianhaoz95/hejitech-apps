# Deploying HQ

HQ runs as one Cloudflare Worker (portal, API, MCP, hourly cron) with a D1 database, an R2 bucket
and a KV namespace, plus a **runner** on a machine that has the repo checked out (this Mac, for
iOS builds and signing). Nothing here has been deployed yet; these are the steps.

## 1. Cloudflare (once)

```sh
cd projects/hq/services/web
npx wrangler d1 create hq                 # put the printed database_id in wrangler.jsonc env.production
npx wrangler r2 bucket create hq-files
openssl rand -hex 32 | npx wrangler secret put HQ_OWNER_TOKEN --env production   # keep a copy in ~/Credentials
npm run deploy                            # applies migrations, deploys https://hq.hejitech.workers.dev
curl -s https://hq.hejitech.workers.dev/api/health-check
```

Then link Workers Builds in the dashboard like the other projects: repo root, build `npm ci`,
deploy `npm run deploy -w @hq/web`, non-production `npm run upload-version -w @hq/web`, watch path
`projects/hq/*`.

## 2. Tokens and the first sync

In the portal (Settings → Connect agents), create a **runner** token and an **agent** token. Then,
from the repo:

```sh
export HQ_URL=https://hq.hejitech.workers.dev HQ_TOKEN=hq_run_… HQ_AGENT_TOKEN=hq_agt_…
npm run -s hq -- lint && npm run -s hq -- sync
```

## 3. The runner on this Mac

```sh
HQ_DENY_TOOLS='Bash(*cut_release.sh*)' npm run -s hq -- runner      # foreground; Ctrl-C to stop
```

To keep it running, a launchd agent (`~/Library/LaunchAgents/com.hejitech.hq-runner.plist`) that
runs the same command from the repo root with those variables. Builds go to `~/.hq/worktrees`
(`HQ_WORKDIR`), from `main` (`HQ_BASE`).

## 4. iPhone app

`cd projects/hq/apps/ios && xcodegen generate && open HQ.xcodeproj`, run the `App` scheme on the
iPhone from Xcode (the first device build needs a person to allow keychain access for codesign),
then sign in with the Worker URL and the owner token. TestFlight: create the App Store Connect
record for `com.hejitech.hq` first, then add `hq-testflight.yml` like the other iOS projects.

## 5. Connecting other agents

- **OAuth-capable MCP clients** (Claude, others): add `https://hq.hejitech.workers.dev/mcp`; approve
  on the consent page with the owner token.
- **Headless agents**: an agent token as `Authorization: Bearer hq_agt_…` on `/mcp`.
- **A different CEO**: set `agents.ceo` in the root `.hq/HQ.md` and give the runner a template,
  e.g. `HQ_AGENT_CODEX_CMD='codex exec --full-auto "$(cat {prompt_file})"'` (untested).
