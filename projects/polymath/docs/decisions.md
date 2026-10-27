# Polymath Architecture Decisions

Record of architectural decisions and trade-offs.

## 2026-10-27: Initial Architecture & Product Shape

### Context
The user wanted a project to learn and practice deep systems (PyTorch, TRT-LLM, SGLang, vLLM, and zero-to-hero post-training infra) with local AI agent execution, interactive diagramming, and long-term multi-domain extensibility.

### Decision
1. **Agent-Authored Course Engine**: Rather than locking into a rigid 4-mode application, the product is packaged as a **Tauri Desktop App** that acts as an **interactive course player and component runtime**.
2. **Managed Directory & Seeding**: When creating a tutorial/course, the app provisions a managed directory on the local disk (`~/heji-courses/<slug>/`), pre-seeds it with Agent Skills (`.agents/skills/course-author/`) and a local MCP tool suite, and launches an embedded managed terminal.
3. **Bring Your Own Agent (BYOA)**: The user runs their favorite coding agent (Claude Code, Google Antigravity, Cursor, etc.) in the managed terminal. The agent uses the pre-seeded skills and MCP tools to author progressive chapters, configure interactive UI widgets, and write pytest verification suites.
4. **Local-First with Profile Sync**:
   - Courses remain strictly local-first on the user's filesystem (untracked in cloud for maximum privacy, zero cloud storage costs, and instant local execution).
   - Shared Supabase project (`schema polymath`) stores user profile, auth via Google PKCE, and UI preferences (theme, font size, active course list).
5. **Surfaces**:
   - **Desktop**: Native Tauri v2 app (Rust backend + Vite/React frontend with embedded terminal PTY, sandboxed runner, and component library).
   - **Worker**: Cloudflare Worker (`@polymath/web`) hosting documentation, public course showcase / player, and OAuth MCP server (`/mcp`).
   - **Shared Library**: `@polymath/core` defining schema validation for courses, chapters, component tags, and user preferences.
6. **Starter Course**: Pre-seed with "PyTorch Deep Systems: Building vLLM, SGLang & TensorRT-LLM" covering KV Cache allocation, PagedAttention block management, and Radix tree prefix caching.
