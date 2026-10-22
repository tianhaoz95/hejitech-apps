# Build-next ledger

Ideas heji-build-next proposed for this project and what the owner decided. The skill reads this
before proposing (see .claude/skills/heji-build-next/SKILL.md, "The ledger"). Newest first.

| Date | Idea | Outcome | Evidence | Why / owner's note | Revisit if |
|---|---|---|---|---|---|
| 2026-10-21 | search_feedback MCP tool | merged in 1.1.0 | cli/src/mcp/server.ts | fixed before merge: LIKE wildcards escaped, documented | – |
| 2026-10-21 | Offline report spooling (Swift SDK) | merged in 1.1.0 | Sources/FeedbackKit/Networking/OfflineReportQueue.swift | fixed before merge: flush stops when offline; flush tests | – |
| 2026-10-21 | More PII redaction in web-SDK logs | merged in 1.1.0 | web-sdk/src/logs.ts | fixed before merge: cards before phones, stricter phone pattern | – |
| 2026-10-21 | User Interaction Breadcrumbs & Action Trail (Web SDK) | not picked | projects/feedbackkit/web-sdk/src/logs.ts:25 only captures console/fetch errors; zero user interaction breadcrumbs | – | – |
| 2026-10-21 | In-Widget Audio/Voice Memo Recording for Web SDK | not picked | projects/feedbackkit/web-sdk/src/ui/widget.ts:629 only allows file attachments and photos | – | – |
