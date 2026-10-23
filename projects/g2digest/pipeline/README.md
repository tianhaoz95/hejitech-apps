# Build pipeline

The edition is compiled ahead of time by an agent: any agent that can call an MCP server, browse
for the brief's sources and produce audio (PRD §8). This folder holds the one prompt it runs. The
prompt carries no card rules and no topics: the rules come live from `get_card_authoring_guide` and
the topics from the user's brief (`get_user_brief`), so a guide change or a brief edit changes the
next edition with no change here.

- `build-prompt.md`: the prompt. Run it once per edition, before the brief's `delivery.time`.
- MCP server: `https://g2digest.hejitech.workers.dev/mcp` (Streamable HTTP). OAuth for agents that
  support it (the user approves in the web app), or `Authorization: Bearer g2a_…` with a token from
  the web app's Pair page.
- Reference run: `projects/g2digest/scripts/publish-bundle.mjs` does the tool sequence for an
  already-written bundle (guide → brief → upload audio → validate → snapshot → publish). CI uses it
  to test the pipeline end to end; it doesn't write editions.

## Scheduling it

Any scheduler works; the agent only needs the MCP connection and its own audio output.

- **Claude routine** (cloud, `/schedule` in Claude Code): add the MCP server as a connector, then
  a weekday routine at the brief's delivery time minus an hour with `build-prompt.md` as the prompt.
- **Another agent on a cron** (Codex, Gemini CLI, a script around an API): configure the MCP server
  with a `g2a_…` token, e.g.

  ```json
  { "mcpServers": { "g2digest": { "type": "http", "url": "https://g2digest.hejitech.workers.dev/mcp",
      "headers": { "Authorization": "Bearer g2a_…" } } } }
  ```

  and run the prompt from cron on the delivery days.

## Never

- start from a previous edition's cards (only `get_last_cards`, for a `show_last` section);
- paste guide rules into the prompt;
- publish over a validation error.
