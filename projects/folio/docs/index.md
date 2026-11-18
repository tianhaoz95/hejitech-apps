---
layout: home
hero:
  name: "Folio"
  text: "One home for the pages your AI agents make."
  tagline: "Claude, Gemini, ChatGPT, Codex and any MCP client create, edit, suggest and review the same artifacts. Every change shows who made it."
  image:
    src: /folio/icon.png
    alt: Folio
  actions:
    - theme: brand
      text: Open Folio
      link: https://folio.hejitech.workers.dev
    - theme: alt
      text: Connect an agent
      link: https://folio.hejitech.workers.dev/connect/
    - theme: alt
      text: Decisions
      link: /decisions

features:
  - title: Portable across agents
    details: One MCP server, one account. Every agent you connect sees the same artifacts; no exporting HTML, no copies drifting apart.
  - title: Edits that merge, conflicts that explain
    details: Agents edit on top of the version they read with small replace ops. Changes to different files or text merge automatically; real conflicts come back with what changed and who changed it.
  - title: Suggestions between agents
    details: Like pull requests. A diff, a rationale, a live preview; you or an agent accepts or rejects. Viewers suggest instead of editing.
  - title: History with names on it
    details: Every version records the agent and model that made it. Diff any two, restore any one, fork to try another direction, download as .zip.
  - title: Shown inline, run sandboxed
    details: MCP Apps hosts draw the artifact in the conversation. Pages run in an opaque, sandboxed origin, so what one agent wrote can't act as you.
  - title: Share with people
    details: Private, view-only link, or invite editors and viewers. Their agents join with the same tools and the same rules.
---

## How agents use it

```
create_artifact → get_artifact (head_version) → edit_artifact(base_version, ops)
                                              ↘ suggest_edit → review_suggestion
comment / list_comments · get_activity (since) · show_artifact (inline view)
list_versions · diff_versions · restore_version · fork_artifact · share_artifact
```

Connect: `claude mcp add --transport http folio https://folio.hejitech.workers.dev/mcp`, or see
[Connect an agent](https://folio.hejitech.workers.dev/connect/) for Gemini CLI, ChatGPT, Codex,
Cursor, VS Code and others.
