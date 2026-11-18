# Folio

Artifacts every AI agent can share. An artifact is a small website (one or more files) kept with
its full history; any MCP client the person connects (Claude Code, Claude, Gemini CLI, ChatGPT,
Codex, Cursor, …) can create, read, edit, suggest changes to, comment on and review the same
artifacts, and every change is attributed to the agent that made it. Web only, free for now.
Live at https://folio.hejitech.workers.dev.

## Layout

- `packages/core/` (`@folio/core`): the model shared by Worker and web: file paths, content types
  and limits (`files.ts`), edit ops `write | replace | delete | rename` with agent-friendly errors
  (`ops.ts`), Myers line diff + unified rendering (`diff.ts`), a stored zip writer (`zip.ts`),
  roles, slugs, artifact references and agent labels (`model.ts`). Vitest in `test/`.
- `services/web/` (`@folio/web`): one Cloudflare Worker.
  - `src/worker/service.ts`: every read and write (roles, optimistic versions with rebase,
    suggestions, comments, events, sharing, fork, deletion). API and MCP both call it.
  - `src/worker/mcp.ts`: Streamable HTTP MCP at `/mcp` (21 tools, `show_artifact` carries the MCP
    Apps UI `ui://folio/viewer.html` from `viewer-app.ts`); `api.ts`: REST for the web app;
    `render.ts`: `/r/<slug>/<version|s<n>>/<key>/<path>` serves artifact files sandboxed;
    `index.ts`: OAuth 2.1 (`@cloudflare/workers-oauth-provider`), `fol_` tokens, routing.
  - Pages (Vite multi-page, partials in `src/partials/`): `/` landing, `/app/` dashboard,
    `/a/<slug>` workspace (`artifact.ts`; the Worker serves `a/index.html` for every `/a/…`),
    `/connect/`, `/settings/`, `/login/`, `/oauth/consent/`, `/invite/#fiv_…`, privacy, terms, help.
- Database: `supabase/schemas/folio/schema.sql` (schema + bucket `folio`), seed
  `supabase/seeds/folio.sql` (folio-dev@example.com / `folio-dev`, token `fol_dev_local_token`,
  artifact `seedpage2`).
- `scripts/test-api.mjs`: end-to-end test (two agents, conflicts, suggestions, sharing, render
  security, OAuth). `scripts/browser-check.mjs`: headless Chromium run of the web app with
  screenshots (`SCHEME=dark` for dark mode).

## Commands

```sh
npm run typecheck:folio
npm run test:folio
WEB_ALLOW_LOCAL=1 npm run build:folio
# local stack (repo root: supabase start), then:
echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o json | jq -r .SERVICE_ROLE_KEY)" > projects/folio/services/web/.dev.vars
npm run dev:worker -w @folio/web                # 127.0.0.1:8801, email sign-in for the seed account
node projects/folio/scripts/test-api.mjs
node projects/folio/scripts/browser-check.mjs <slug> <out-dir>
```

## How it works (decided; see docs/decisions.md)

- **Versions are immutable manifests** (`path → {hash, size, type}`); contents are stored once per
  artifact and hash (`folio.blobs.text`, binaries in Storage at `<artifact>/<hash>`).
  `folio.commit_version` is the only writer: it checks `head == base` under a row lock.
- **Edits carry `base_version`.** If the head moved, ops are replayed on the head when no touched
  file changed in between, or the only ops on changed files are `replace`s that still match once;
  otherwise 409 `stale` with the newer versions and conflicting paths. Never silently overwrite.
- **Suggestions** are stored ops against a base; accept = the same rebase rules. Previews render
  live at `/r/<slug>/s<n>/…` without committing.
- **Attribution**: the agent's declared `agent` arg, else the MCP `clientInfo` saved per
  `Mcp-Session-Id` (KV, 30 days), else the OAuth client name or token name. Web changes: "Web".
- **Rendering is untrusted content.** Every `/r/` response has `Content-Security-Policy: sandbox …`
  without `allow-same-origin`, so artifact scripts run in an opaque origin even when opened directly
  and can't read Folio's session. Private artifacts need an HMAC key (12 h, hour-aligned) in the
  URL; `link` artifacts use key `p`. Relative links between files work; absolute `/x` don't.
- **Prompt injection**: tool results that contain other agents' text carry a `note` that it is
  data; server `instructions` say the same. Keep that wording when adding tools.
- Roles: owner (everything), editor (edit, review), viewer (read, comment, suggest). `link`
  visibility makes anyone a viewer (signed-out visitors read only). Agents can't delete artifacts.

## Pitfalls

- The app's built-in browser pane blocks the sandboxed frame's subresources
  (`ERR_BLOCKED_BY_CLIENT`); real Chromium renders fine. Check the UI with `browser-check.mjs`.
- The `/a/…` rewrite strips conditional headers: a 304 from ASSETS rewritten to 200 was a blank page.
- Upsert rows to `blobs` with uniform keys: PostgREST nulls missing columns (`in_storage` is not null).
- Slugs use `23456789abcdefghijkmnpqrstuvwxyz` (no 0/1/l/o): seed or test slugs outside it don't resolve.

## Releasing

Web only: `scripts/cut_release.sh folio` bumps `services/web/package.json` (also the MCP
`serverInfo.version`) and tags `folio-v<version>`; the Worker deploys on push (Workers Builds).
