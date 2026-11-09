# Deploying HQ

HQ runs as one Cloudflare Worker (portal, API, MCP, hourly cron) on the shared Supabase project
(schema `hq`, bucket `hq`, sign-in), plus **runners** that each workspace runs on machines with its
repo checked out. Nothing here has been deployed yet; these are the steps.

## 1. Database (once)

```sh
supabase db push --dry-run && supabase db push      # applies supabase/migrations/*_hq_init.sql
```

Then in the Supabase dashboard (project `jitdzllkxfhlrxxvljhp`): **API settings → exposed schemas**:
add `hq`. **Auth → URL configuration → redirect URLs**: add `https://hq.hejitech.workers.dev/**`
and `hq://login-callback` (read the list first and extend it; the Site URL belongs to Waypack).

## 2. Sign-in providers

- **Google** and **Apple** are already enabled on the shared project. For the iPhone app's native
  Apple sheet, add `com.hejitech.hq` to Apple's client IDs (comma-separated list).
- **GitHub** (recommended for HQ: every workspace is a GitHub repo) isn't enabled yet. Create a
  GitHub OAuth App (callback `https://jitdzllkxfhlrxxvljhp.supabase.co/auth/v1/callback`) and enable
  the GitHub provider with its client id and secret. Until then the GitHub button shows Supabase's
  "provider not enabled" error.

## 3. The Worker

```sh
cd projects/hq/services/web
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production   # a separate secret API key named "hq" is best
npm run deploy                                                       # https://hq.hejitech.workers.dev
curl -s https://hq.hejitech.workers.dev/api/health-check
```

Then link Workers Builds in the dashboard like the other projects: repo root, build `npm ci`,
deploy `npm run deploy -w @hq/web`, non-production `npm run upload-version -w @hq/web`, watch path
`projects/hq/*`.

## 4. A workspace for this repo

1. Sign in at https://hq.hejitech.workers.dev, create a workspace for `tianhaoz95/hejitech-apps`.
2. Settings → invite teammates (approver or viewer), and create a **runner** token and an **agent**
   token.
3. From the repo:

```sh
export HQ_URL=https://hq.hejitech.workers.dev HQ_TOKEN=hq_run_… HQ_AGENT_TOKEN=hq_agt_…
npm run -s hq -- lint && npm run -s hq -- sync
HQ_DENY_TOOLS='Bash(*cut_release.sh*)' npm run -s hq -- runner      # foreground; Ctrl-C to stop
```

To keep the runner going, a launchd agent (`~/Library/LaunchAgents/com.hejitech.hq-runner.plist`)
that runs the same command from the repo root with those variables. Builds go to `../.hq-worktrees`
next to the repo, on the same disk (`HQ_WORKDIR`), from `main` (`HQ_BASE`).

## 5. iPhone app

`cd projects/hq/apps/ios && xcodegen generate && open HQ.xcodeproj`, run the `App` scheme on the
iPhone from Xcode (the first device build needs a person to allow keychain access for codesign).
Release builds talk to production. TestFlight: create the App Store Connect record for
`com.hejitech.hq` first (skill `heji-app-store-connect`), then add `hq-testflight.yml` like the
other iOS projects.

## 6. Connecting other agents

- **OAuth-capable MCP clients**: add `https://hq.hejitech.workers.dev/mcp`; on the consent page an
  admin or approver picks the workspace and allows it.
- **Headless agents**: a workspace agent token as `Authorization: Bearer hq_agt_…` on `/mcp`.
- **A different CEO**: set `agents.ceo` in the root `.hq/HQ.md` and give the runner a template,
  e.g. `HQ_AGENT_CODEX_CMD='codex exec --full-auto "$(cat {prompt_file})"'` (untested).
