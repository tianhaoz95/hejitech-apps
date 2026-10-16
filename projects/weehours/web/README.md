# Wee Hours website

A static multi-page site: landing page, AI agent (MCP) setup guide, account page, OAuth consent screen for MCP clients, privacy policy, terms and support. Built with Vite and served as Cloudflare static assets.

| Path | What |
|---|---|
| `/` | Landing page |
| `/agents/` | Connecting Claude, ChatGPT, Claude Code and other MCP clients |
| `/account/` | Sign in, household status, access tokens, connected assistants, CSV export, delete household data |
| `/oauth/consent/` | Supabase OAuth server consent screen (`auth.oauth_server.authorization_url_path`) |
| `/privacy/`, `/terms/`, `/support/` | App Store privacy policy and support URLs |

## Develop

```bash
supabase start            # from the repo root
cd web && npm install
npm run dev               # http://127.0.0.1:3000 (the local auth site_url); dev shows email sign-in
```

Sign in with `parent1@example.com` / `newborn-dev`.

## Deploy (Cloudflare)

Set these at build time (see `.env.example`). The production build refuses to run without them:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for the hosted project
- `VITE_SUPPORT_EMAIL`
- `VITE_APP_STORE_URL` (optional; empty shows "Coming soon to the App Store")

```bash
npm run build && npx wrangler deploy     # wrangler.jsonc serves ./dist; add `main` if a Worker script is needed later
```

`public/_headers` sets security headers and blocks framing of `/account` and `/oauth`.

Hosted Supabase settings that depend on the site's domain:

- **Auth → URL configuration:** set Site URL to the site's origin and add `https://<domain>/**` to the redirect URLs.
- **Auth → OAuth server:** enable it and set the authorization path to `/oauth/consent` so MCP clients that sign in land on the consent page.
