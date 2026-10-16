# Wee Hours website + Worker

One Cloudflare Worker (`wrangler.jsonc`) serves the Vite-built pages and the MCP server:

| Path | What |
|---|---|
| `/` | Landing page |
| `/agents/` | Connecting Claude, ChatGPT, Claude Code and other MCP clients |
| `/account/` | Sign in, household status, access tokens, connected assistants, CSV export, delete household data |
| `/oauth/consent/` | Consent screen for MCP clients (the Worker's `/authorize` sends the browser here) |
| `/privacy/`, `/terms/`, `/support/` | App Store privacy policy and support URLs |
| `/mcp` | MCP server (Streamable HTTP): OAuth access token or `wh_…` personal access token (`src/worker/mcp.ts`) |
| `/authorize`, `/token`, `/register`, `/.well-known/*` | The Worker's own OAuth 2.1 server (`src/worker/index.ts`, `@cloudflare/workers-oauth-provider`) |
| `/api/grants` | Connected assistants for the account page (list, revoke) |

The Supabase project is shared by every HEJI app, so Supabase's built-in OAuth server (one consent URL per project) isn't used. Grants live in the `OAUTH_KV` namespace; the Worker reads Wee Hours' tables with the service-role key, on the `weehours` schema.

## Develop

```bash
supabase start                          # from the repo root (shared stack, ports 554xx)
npm install                             # from the repo root
npm run dev -w @weehours/web            # pages only: http://127.0.0.1:3000; dev shows email sign-in
npm run dev:worker -w @weehours/web     # pages + Worker: http://127.0.0.1:8788 (MCP at /mcp)
node ../../scripts/test-mcp.mjs         # MCP + OAuth integration checks against dev:worker
```

`dev:worker` needs `.dev.vars` (git-ignored) with `SUPABASE_SERVICE_ROLE_KEY=` the local key from `supabase status`. Sign in with `parent1@example.com` / `newborn-dev`.

## Deploy

`npm run deploy -w @weehours/web` builds with `.env.production` (public values, committed) and deploys the `production` environment (`weehours`, https://weehours.hejitech.workers.dev). Cloudflare Workers Builds runs the same on push to `main`. The one secret is `SUPABASE_SERVICE_ROLE_KEY` (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production`). See `../../docs/DEPLOY.md`.

`public/_headers` sets security headers and blocks framing of `/account` and `/oauth`.
