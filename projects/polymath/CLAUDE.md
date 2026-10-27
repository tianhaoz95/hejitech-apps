# Polymath

Agent-native interactive course player and extensible learning runtime. Turns local coding agents (Claude Code, Google Antigravity, Cursor, etc.) into course authors by providing managed workspaces pre-seeded with Agent Skills, MCP tools, and an interactive UI widget library.

## Layout

- `packages/core/` (`@polymath/core`): TypeScript schemas for courses, chapters, interactive widgets (`<MemoryBlockGrid>`, `<CodeExercise>`, `<RooflinePlot>`, `<ClusterTopology>`, `<InteractiveWhiteboard>`, `<SocraticQuiz>`), test validation, and user profile preferences.
- `services/web/` (`@polymath/web`): Cloudflare Worker serving the web showcase and public course viewer (`/`), Google sign-in (`/login`), OAuth 2.1 consent (`/oauth/consent`), profile API (`/api/profile`), and Streamable HTTP MCP server (`/mcp`).
- `apps/desktop/` (`@polymath/desktop`): Tauri v2 desktop application (Rust backend + Vite/React frontend) hosting the interactive Course Player, embedded PTY terminal runner, sandbox executor, and course generator.
- `docs/`: VitePress documentation pages (`pages.json`, `index.md`, `decisions.md`, `DEPLOY.md`).

## Commands

```sh
npm run typecheck:polymath
npm run test:polymath
npm run build:polymath
npm run dev -w @polymath/desktop
npm run dev:worker -w @polymath/web
```

## Architectural Invariants

1. **Local-First Courses**: Course directories live locally on the user's filesystem (`~/heji-courses/<slug>/`) as standard Markdown, JSON, and Python files. They are NOT synced to the cloud.
2. **Minimal Backend Footprint**: The shared Supabase project (`schema polymath`) stores only user preferences (theme, font size) and active profile metadata via Google PKCE authentication.
3. **Bring Your Own Agent (BYOA)**: The managed workspace pre-seeds standard Agent Skills (`.agents/skills/course-author/SKILL.md`) and local MCP servers so any agent running in the terminal understands how to construct a course.
4. **Declarative Component SDK**: Interactive widgets are declared in standard Markdown as clean JSX tags. No arbitrary JavaScript execution inside course files.
