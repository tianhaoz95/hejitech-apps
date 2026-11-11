# HQ

The autopilot "CEO" for a repository, as a product teams sign up for: a workspace is one repo
(HQ is built for monorepos) and the people who work on it. Scheduled agents scout for maintenance, reliability,
performance and opportunity work and propose it as evidence-backed cards; you approve, reject or
discuss them in a web portal or the iPhone app in a few minutes a day, each with their role (admin, approver, viewer); executors build what you
approve on branches, a second agent reviews the result, and you ship it. New product ideas stay
yours.

HQ works on any repo that adds `.hq/` folders: `HQ.md` (policy HQ enforces + guidance agents read)
and `bin/` verbs (`health`, `verify`, `release`, …) that wrap the repo's own scripts.

| Part | Where |
|---|---|
| Contracts in code (card, policy, context) | `packages/core` |
| Worker: portal, API, MCP server, scheduler | `services/web` |
| `hq` CLI + runner + agent adapters (published as `@hejitech/hq`) | `apps/cli` |
| iPhone app | `apps/ios` |

Start here: `CLAUDE.md` (commands, architecture), `docs/decisions.md`, `docs/DEPLOY.md`.
