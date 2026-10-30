# Deployment

The board runs on the shared HEJI Supabase project (`jitdzllkxfhlrxxvljhp`, schema `tradeboard`) and
one Cloudflare Worker (`https://tradeboard.hejitech.workers.dev`). The executor runs on the owner's
machine. Steps in order; each says who does it.

## 1. Database (once)

```sh
supabase db push --dry-run     # from the repo root: should list only *_tradeboard_init.sql
supabase db push
```

Then expose `tradeboard` in the Supabase API settings (read the list first and extend it). No
bucket: the board stores no files.

## 2. Auth (once)

Read the current redirect allow-list, then add `https://tradeboard.hejitech.workers.dev/**` (the
portal's Google and Apple sign-in returns to `/login/`). The Site URL belongs to Waypack; Google and
Apple web sign-in already work for the project.

## 3. Worker

Cloudflare Workers Builds (dashboard, the owner): new project from this repo, root directory = repo
root, build `npm ci`, deploy `npm run deploy -w @tradeboard/web`, non-production
`npm run upload-version -w @tradeboard/web`, watch path `projects/tradeboard/*`. The first deploy
provisions `OAUTH_KV`. Three secrets:

```sh
cd projects/tradeboard/services/web
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
npx wrangler secret put OWNER_EMAIL --env production     # the one account that may sign in
openssl rand -base64 32 | npx wrangler secret put TOTP_ENC_KEY --env production   # seals the TOTP secret
```

Smoke test:

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://tradeboard.hejitech.workers.dev/mcp          # 401 + OAuth hint
curl -s https://tradeboard.hejitech.workers.dev/.well-known/oauth-authorization-server | jq .issuer
curl -s -o /dev/null -w "%{http_code}\n" https://tradeboard.hejitech.workers.dev/api/board    # 401
```

Then sign in at `https://tradeboard.hejitech.workers.dev/login/` and enroll the authenticator. The
board creates policy v1 (the §9.2 defaults) and a DEMO plan on first use.

## 4. Agents

Agents page → register each agent; connect Claude (Settings → Connectors → Add custom connector →
`https://tradeboard.hejitech.workers.dev/mcp`), pick the agent id on the consent page. Agents without
OAuth get a token from the same page.

## 5. Executor (the owner's machine)

1. Executor page → New executor credential (shown once).
2. On the machine (the Spark: `ssh dgx`):

   ```sh
   curl -fsSLO https://github.com/tianhaoz95/hejitech-apps/releases/download/tradeboard-v0.1.0/install.sh
   bash install.sh 0.1.0
   ~/.tradeboard/bin/tradeboard-executor setup      # board URL, credential, agentic account number, model
   ~/.tradeboard/bin/tradeboard-executor auth       # Robinhood loopback sign-in (README)
   ~/.tradeboard/bin/tradeboard-executor check
   ~/.tradeboard/bin/tradeboard-executor model-check
   systemctl --user enable --now tradeboard-executor
   ```

   Model on the Spark: `gemma4:26b`, already in its Ollama (`http://127.0.0.1:11434/v1`); `model-check`
   should print two `ok` lines. The
   systemd user service stops at logout unless lingering is on (`loginctl enable-linger`, may need
   an admin); otherwise run it in `tmux`.
3. The Executor page shows it online within 30 s, in dry-run.

## 6. Live mode (the owner, when ready)

README §Live mode: the checklist, `"allow_live": true` on the machine, Turn dry-run off, then one
small limit order verified by read-back.

## Recovery

- **Lost authenticator**: with the service key, clear the TOTP so the next sign-in enrolls again
  (the account check still applies):
  `update tradeboard.owner set totp_secret_enc = null, totp_enrolled_at = null, totp_last_step = null;`
  and revoke sessions: `update tradeboard.sessions set revoked_at = now() where revoked_at is null;`
- **Robinhood token expired or revoked**: the Executor page shows "sign-in needed"; run
  `tradeboard-executor auth` again.
- **Executor machine lost**: revoke its credential on the Executor page, then sign out of the
  Robinhood MCP connection from the Robinhood app.
