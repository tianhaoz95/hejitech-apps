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
  the GitHub provider with its client id and secret. Until then the portal and the
  iPhone app offer no GitHub button (removed in 0.1.1); put it back in `services/web/src/lib.ts`
  (`signInView`) and `apps/ios/App/Sources/SignInView.swift` once the provider is on.

## 3. The Worker

```sh
cd projects/hq/services/web
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production   # a separate secret API key named "hq" is best
npm run deploy                                                       # https://hq.hejitech.workers.dev
curl -s https://hq.hejitech.workers.dev/api/health-check
```

Workers Builds is linked (since 2026-11-13) like the other projects: repo root, build `npm ci`,
deploy `npm run deploy -w @hq/web`, non-production `npm run upload-version -w @hq/web`, watch path
`projects/hq/*`. Every push to `main` touching `projects/hq/` redeploys the Worker.

## 4. A workspace for this repo

1. Sign in at https://hq.hejitech.workers.dev, create a workspace for `tianhaoz95/hejitech-apps`.
2. Settings → invite teammates (approver or viewer).
3. From the repo:

```sh
npm run -s hq -- login     # address (Enter for the hosted HQ), then allow it in the browser as an admin
npm run -s hq -- lint && npm run -s hq -- sync
HQ_DENY_TOOLS='Bash(*cut_release.sh*)' npm run -s hq -- runner      # foreground; Ctrl-C to stop
```

`hq login` creates a **runner** token and an **agent** token (`hq login on <machine>` in Settings →
Tokens) and saves them in `~/.config/hq/credentials.json` for this repo; `hq logout` forgets them.
It can also take a pasted runner token (`--token`), and `--no-open` prints the link for another
device. A machine without a person skips it: create the two tokens in Settings and set

```sh
export HQ_URL=https://hq.hejitech.workers.dev HQ_TOKEN=hq_run_… HQ_AGENT_TOKEN=hq_agt_…
```

which always win over a saved login.

The runner is optional (§6: sweeps do the same work in any connected agent's session); it's the
way to work on a machine nobody watches, with each agent under a hard deny-list. To keep it going, a launchd agent (`~/Library/LaunchAgents/com.hejitech.hq-runner.plist`)
that runs the same command from the repo root, after `hq login` as the same user or with those variables. Builds go to `../.hq-worktrees`
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
- **Everything over MCP, no CLI**: in any connected session opened on the repo, say "do a sweep
  for HQ" (or use the server's `sweep` prompt, `/hq:sweep` in Claude Code). The agent calls
  `start_sweep` and does every kind of queued work in that session: waiting requests, replies to
  comments, verbs someone asked for, the health check, the scouts that are due, the CEO's ranking,
  builds of approved cards (each in `../.hq-worktrees/<repo>-<card>` on branch `hq/<card>`, the
  project's `verify` run there, pushed with a PR only when `push: true`) and reviews of cards
  another session built; then `finish_sweep`. It ends by refreshing HQ's copy of the policy
  (`sync_policy`: the agent lists the `.hq/` files with `git ls-tree`, HQ reads them from GitHub),
  so `hq sync` isn't needed either (public repos; a private one still syncs with the CLI). For a
  routine, make a scheduled task in the Claude desktop app (or any agent's scheduler, or a cron job
  running a headless agent) in a session on this repo with HQ's MCP server connected, with the
  prompt "Do a sweep for HQ" (daily, say). The schedules in `.hq/HQ.md` still decide which scouts
  are due, so a sweep more often than that only does what's due. A sweep runs with the session's
  own permissions: set that agent's tool permissions to what a build may do (no `cut_release.sh`,
  no deploys) if it runs unattended. One thing still differs from a runner: a review is refused to
  the session that built the card, so a card built in today's sweep is reviewed by the next one (or
  by another session); with `push: false` that must be on the same machine, since the branch is
  local. A sweep that can't do a run (a missing tool or key, a branch it can't see) hands it back
  (`released`) for another session or a runner.
- **A different CEO**: set `agents.ceo` in the root `.hq/HQ.md` and give the runner a template,
  e.g. `HQ_AGENT_CODEX_CMD='codex exec --full-auto "$(cat {prompt_file})"'` (untested).

## 7. The `hq` command on npm and GitHub Packages

`hq-cli-release.yml` publishes `apps/cli` for every `hq-v<version>` release, with that version:

- **npm**: `@hejitech/hq` (`npm install -g @hejitech/hq`, then `hq login`), with provenance.
- **GitHub Packages**: the same files as `@tianhaoz95/hq`. GitHub only accepts names in the scope
  of the repo's owner from the workflow's own token, so it can't be `@hejitech/hq` there.

It packs once, checks the tarball on Node 20, and skips a version that is already published, so
re-running it is safe. Started by hand without a tag it rehearses the current branch and publishes
nothing; that run also checks the npm token (it warns if the token is rejected or its account isn't
in the `hejitech` organization).

Tokens: npm uses `NPM_TOKEN`, the owner's npm token shared by every npm package this repo publishes
(a copy is in `~/Credentials/npm.env`; it expires on 2026-12-20); GitHub Packages uses the built-in `GITHUB_TOKEN`. Nothing new to
store. One-time setup on npm: the organization `hejitech` must exist (npmjs.com → Add Organization,
free for public packages) with the token's account in it, and if the token is a granular one it
must allow the `@hejitech` scope.

Installing from GitHub Packages needs `@tianhaoz95:registry=https://npm.pkg.github.com` in `.npmrc`
and a GitHub token even for public packages; npm is the one to point people at.
