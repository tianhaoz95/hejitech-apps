# Build-next ledger

Ideas heji-build-next proposed for this project and what the owner decided. The skill reads this
before proposing (see .claude/skills/heji-build-next/SKILL.md, "The ledger"). Newest first.

| Date | Idea | Outcome | Evidence | Why / owner's note | Revisit if |
|---|---|---|---|---|---|
| 2026-10-21 | Trip search and filters | merged in 1.9.0 | apps/mobile/lib/screens/trips_screen.dart | fixed before merge: header and chips fit | – |
| 2026-10-21 | Storage breakdown and Clear map cache | merged in 1.9.0 | apps/mobile/lib/services/trip_store.dart, lib/state/app_state.dart clearMapCache | fixed before merge: trips record that their maps are gone | – |
| 2026-10-21 | Morning trip briefings | merged in 1.9.0 | apps/mobile/lib/services/notifications.dart scheduleDailyBriefings | capped at the next 10 mornings per trip | – |
| 2026-10-21 | Packing & Gear Checklist Section in Trip PDF Export | not picked | projects/waypack/apps/mobile/lib/services/pdf_export.dart:28 only builds cover, days, and places sections | – | – |
| 2026-10-21 | CLI Standalone HTML/PDF Export Command (waypack export) | not picked | projects/waypack/packages/cli/src/cli.ts:14 lacks an export command | – | – |
