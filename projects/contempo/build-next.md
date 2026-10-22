# Build-next ledger

Ideas heji-build-next proposed for this project and what the owner decided. The skill reads this
before proposing (see .claude/skills/heji-build-next/SKILL.md, "The ledger"). Newest first.

| Date | Idea | Outcome | Evidence | Why / owner's note | Revisit if |
|---|---|---|---|---|---|
| 2026-10-21 | PDF audit binder export | merged in 3.2.0 | ios/Contempo/Sources/App/Export/PdfExportGenerator.swift; IRS IR-2025-128 (2026 rate 72.5¢) | fixed before merge: paginates every entry, 72.5¢ rate | – |
| 2026-10-21 | Dashboard property/category filter and search | merged in 3.2.0 | ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift | fixed before merge: owner-only subtotal, category menu | – |
| 2026-10-21 | Siri and Shortcuts: start/stop timer, log hours | merged in 3.2.0 | ios/Contempo/Sources/App/Intents/ContempoIntents.swift | fixed before merge: one AppShortcutsProvider (app only) | – |
| 2026-10-21 | Mileage arrival alert | merged in 3.2.0 | ios/Contempo/Sources/App/Mileage/ArrivalDetector.swift | fixed before merge: fixes while parked, background updates, notification permission | – |
| 2026-10-21 | Interactive Entry Creation & Editing on Web Dashboard | not picked | projects/contempo/services/web/src/pages/EntriesPage.tsx:11 only reads entries; no insert/update functions exist | – | – |
