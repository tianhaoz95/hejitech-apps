# Build-next ledger

Ideas heji-build-next proposed for this project and what the owner decided. The skill reads this
before proposing (see .claude/skills/heji-build-next/SKILL.md, "The ledger"). Newest first.

| Date | Idea | Outcome | Evidence | Why / owner's note | Revisit if |
|---|---|---|---|---|---|
| 2026-10-22 | iOS 18 Control Center Quick-Log Controls (Diaper & Sleep Controls) | merged in 0.10.0 | projects/weehours/apps/ios/Widgets/Widgets.swift:8-16 | Dedicated ControlWidgetButtons for diaper changes and sleep toggle | – |
| 2026-10-22 | MCP Daily Aggregates & Pediatric Stats Tool (get_daily_summary) | merged in 0.10.0 | projects/weehours/services/web/src/worker/mcp.ts:43-173 | Authoritative daily pediatric summaries computed directly on server | – |
| 2026-10-22 | Breast Milk & Formula Safe Storage Expiry Tracker | merged in 0.10.0 | projects/weehours/apps/ios/App/Sources/HomeView.swift:96 | CDC safe storage rules (fridge 4d, freezer 6mo) and FIFO batch alerts | – |
| 2026-10-22 | WHO Infant Growth Standards & Percentile Curve Charts | not picked twice | projects/weehours/apps/ios/App/Sources/GrowthView.swift:8-71 only stores raw numbers with no percentile charts | – | – |
| 2026-10-22 | 1-Page Pediatrician Visit Summary Report (PDF Export) | not picked twice | projects/weehours/apps/ios/App/Sources/SettingsView.swift:250 and Household.swift:375 only export raw CSV | – | – |
| 2026-10-22 | Active Timed Activity Quick-Correction & End-Time Backdate | not picked twice | projects/weehours/apps/ios/App/Sources/CareView.swift:46 stops timed sessions only with current timestamp | – | – |
| 2026-10-22 | Infant Wake Window Indicator & Age-Based Nap Cues | not picked | projects/weehours/apps/ios/LogCore/Sources/LogCore/Status.swift:55 calculates lastWakeAt but StatusCard has no wake window indicator | – | – |
| 2026-10-22 | Medication Dosage Interval Safety Guard & "Next Dose Allowed" Tracker | not picked | projects/weehours/apps/ios/App/Sources/CareView.swift:250 logs medication without dosage interval safety checks | – | – |
| 2026-10-22 | Temperature Fever Trend & Unit-Aware Clinical Warning Badge | not picked | projects/weehours/apps/ios/App/Sources/TimelineView.swift:54 and CareView.swift:270 render temperature with no fever threshold classification | – | – |
| 2026-10-22 | Flagged Stool Color Clinical Warning Banner (AAP Biliary Atresia & Blood Alert) | not picked | projects/weehours/apps/ios/LogCore/Sources/LogCore/Model.swift:294 implements isFlagged but TimelineView.swift:757 displays no advisory banner | – | – |
| 2026-10-21 | Live Activity on/off per caregiver | merged in 0.8.8 | apps/ios/App/Sources/Services.swift SessionActivities | – | – |
| 2026-10-21 | Next-feed reminders toggle and next feed due | merged in 0.8.8 | apps/ios/LogCore/Sources/LogCore/Status.swift nextFeedDue | Settings shows the next feed time | – |
| 2026-10-21 | WHO Infant Growth Standards & Percentile Curve Charts | not picked | projects/weehours/apps/ios/App/Sources/GrowthView.swift:10 only stores raw numbers with no percentile charts | – | – |
| 2026-10-21 | 1-Page Pediatrician Visit Summary Report (PDF Export) | not picked | projects/weehours/apps/ios/App/Sources/SettingsView.swift:20 only exports raw CSV string | – | – |
| 2026-10-21 | Overdue Sleep Session Alert & Quick Wake-Time Correction | not picked | projects/weehours/apps/ios/App/Sources/CareView.swift:34 stops timed sessions only with current timestamp | – | – |
