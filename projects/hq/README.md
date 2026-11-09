# HQ

The autopilot "CEO" for a repository. Scheduled agents scout for maintenance, reliability,
performance and opportunity work and propose it as evidence-backed cards; you approve, reject or
discuss them in a web portal or the iPhone app in a few minutes a day; executors build what you
approve on branches, a second agent reviews the result, and you ship it. New product ideas stay
yours.

HQ works on any repo that adds `.hq/` folders: `HQ.md` (policy HQ enforces + guidance agents read)
and `bin/` verbs (`health`, `verify`, `release`, …) that wrap the repo's own scripts.

| Part | Where |
|---|---|
| Contracts in code (card, policy, context) | `packages/core` |
| Worker: portal, API, MCP server, scheduler | `services/web` |
| `hq` CLI + runner + agent adapters | `apps/cli` |
| iPhone app | `apps/ios` |

Start here: `CLAUDE.md` (commands, architecture), `docs/decisions.md`, `docs/DEPLOY.md`.
