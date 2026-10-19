# Listing the MCP server in Claude and ChatGPT

Not submitted yet: the user's call (2026-10-19) is to submit once the product matures, and to keep
the server compliant in the meantime. This page is what both directories ask for and where Wee
Hours stands. Requirements change; re-read the sources before submitting.

## What both ask for

| Requirement | Status |
|---|---|
| Remote server over public HTTPS (Streamable HTTP) | Done: `https://weehours.hejitech.workers.dev/mcp` (the Worker, `services/web/src/worker/mcp.ts`) |
| OAuth sign-in for an authenticated service | Done: the Worker is its own OAuth 2.1 server (dynamic registration, PKCE, consent page) |
| Every tool has a `title` and `readOnlyHint` or `destructiveHint` | Done, and tested (`services/web/test/mcp.test.ts`, "tools"): reads are read-only; `log_event`, `import_events`, `set_tracking` aren't destructive (append-only, undoable); `undo_event`, `undo_import`, `resolve_duplicate` are marked destructive |
| Tool descriptions that describe, not promote | Done; keep it that way (a common ChatGPT rejection) |
| Privacy policy | Done: `/privacy/`, including what connected assistants can read and write |
| Terms | Done: `/terms/`, covers the MCP server and tokens |
| Support contact | `/support/` and the agents guide (`/agents/`, documents every tool). The email is still `support@waypack.app` (`.env.production`) |
| Documentation | `/agents/`: setup for Claude, ChatGPT, Claude Code and other clients, the tool table, read vs write |

## Still to do before submitting

1. **A reviewer account with data**: a household with a few days of entries (feeds, diapers, sleep)
   and email + password sign-in. Production sign-in is Apple/Google only, so either a dedicated
   Google account or enabling email sign-in for one reviewer account.
2. **A Wee Hours domain and support address** instead of `*.workers.dev` and the Waypack mailbox
   (update `PUBLIC_URL`, the OAuth redirect allow-list, `.env.production` and the app's `mcpURL`).
3. **Claude**: submission goes through the Connectors Directory review (Claude.ai admin settings
   for a Team/Enterprise organization, or the review form). See the
   [submission guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)
   and [connector docs](https://claude.com/docs/connectors/building/submission).
4. **ChatGPT**: a verified organization on the OpenAI Developer Platform; the submission carries
   the MCP details, test instructions, directory metadata and countries
   ([announcement](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/)). One
   version in review at a time.
5. Directory listing copy and an icon (the app icon at 512 px works).

When adding a tool: give it a `title` and the hints (the test fails otherwise), list it in the
`/agents/` table, and keep `readOnlyHint` accurate: read-only tokens only see tools with it.
