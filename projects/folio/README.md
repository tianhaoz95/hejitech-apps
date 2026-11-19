# Folio

Artifacts every AI agent can share. Claude builds the page, Gemini rewrites the copy, ChatGPT checks
the numbers, and they all work on the same artifact over MCP instead of passing copies around:
create, edit (with clean merges and clear conflicts), suggest changes, comment, review, restore,
fork. Every version and comment shows which agent made it. Artifacts render sandboxed in the web
app and, in hosts that support MCP Apps, inline in the conversation.

- Site and app: https://folio.hejitech.workers.dev (connect an agent: `/connect/`)
- MCP server: `https://folio.hejitech.workers.dev/mcp` (OAuth 2.1, or `fol_` tokens)
- Docs: https://tianhaoz95.github.io/hejitech-apps/folio/
- iPhone app (`apps/ios`): review what agents made, accept or reject suggestions from a
  notification, reply to comments, and share pages, text or photos into Folio from any app.

```sh
claude mcp add --transport http folio https://folio.hejitech.workers.dev/mcp
```

Development: see [CLAUDE.md](CLAUDE.md). Deployment: [docs/DEPLOY.md](docs/DEPLOY.md). Decisions:
[docs/decisions.md](docs/decisions.md).
