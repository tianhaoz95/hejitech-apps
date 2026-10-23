# Build-next ledger

Ideas heji-build-next proposed for this project and what the owner decided. The skill reads this
before proposing (see .claude/skills/heji-build-next/SKILL.md, "The ledger"). Newest first.

| Date | Idea | Outcome | Evidence | Why / owner's note | Revisit if |
|---|---|---|---|---|---|
| 2026-10-22 | iOS Widget Live Sync & Home Screen Update | merged in 3.3.0 | projects/contempo/ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift | writes confirmed hours to HoursProgressStore and reloads WidgetCenter timelines on entry change | – |
| 2026-10-22 | Android PDF Audit Binder Export & 2026 Mileage Rates | merged in 3.3.0 | projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/export/PdfExportGenerator.kt | multi-page IRS audit binder with Treas. Reg. §1.469-5T(f)(4) disclosure and 2026 72.5¢ rate | – |
| 2026-10-22 | Android Dashboard Property/Category Filter & Live Search | merged in 3.3.0 | projects/contempo/android/app/src/main/java/com/hejitech/contempo/ui/dashboard/DashboardViewModel.kt | filter entries by property, category, and search query with owner-only dynamic subtotal | – |
| 2026-10-22 | Settings Rental Property Roster Management | merged in 3.3.0 | projects/contempo/ios/Contempo/Sources/App/Settings/SettingsScreen.swift | dedicated settings UI to add, rename, and manage rental properties with default property selection | – |
| 2026-10-22 | Configurable Statutory Tax Test Target in Settings | merged in 3.3.0 | projects/contempo/ios/Contempo/Sources/App/Settings/TaxTestStore.swift | configurable tax test picker (100h STR, 500h Material Participation, 750h REPS) updating dashboard target | – |
| 2026-10-22 | Android App Shortcuts for Fast Entry & Timer | merged in 3.3.0 | projects/contempo/android/app/src/main/res/xml/shortcuts.xml | launcher shortcuts for Voice Note, Mileage Trip, and Log Hours with deep linking | – |
| 2026-10-22 | Android Mileage Stationary Arrival Alert | not picked | android/app/src/main/java/com/hejitech/contempo/ui/mileage/LocationTrackingService.kt:85 | – | – |
| 2026-10-22 | Wear OS Hours Accuracy: Owner Role & Tax Year Filter | not picked | android/wear/src/main/java/com/hejitech/contempo/wear/WearDashboardViewModel.kt:42 | – | – |
| 2026-10-22 | Web Dashboard Entry Management (Details, Confirm, Delete) | not picked | services/web/src/pages/EntriesPage.tsx:11 | – | – |
| 2026-10-22 | Web Dashboard Mileage & Vehicle Deductions Tracking | not picked | services/web/src/pages/DashboardPage.tsx:55 | – | – |
| 2026-10-21 | PDF audit binder export | merged in 3.2.0 | ios/Contempo/Sources/App/Export/PdfExportGenerator.swift; IRS IR-2025-128 (2026 rate 72.5¢) | fixed before merge: paginates every entry, 72.5¢ rate | – |
| 2026-10-21 | Dashboard property/category filter and search | merged in 3.2.0 | ios/Contempo/Sources/App/Dashboard/DashboardViewModel.swift | fixed before merge: owner-only subtotal, category menu | – |
| 2026-10-21 | Siri and Shortcuts: start/stop timer, log hours | merged in 3.2.0 | ios/Contempo/Sources/App/Intents/ContempoIntents.swift | fixed before merge: one AppShortcutsProvider (app only) | – |
| 2026-10-21 | Mileage arrival alert | merged in 3.2.0 | ios/Contempo/Sources/App/Mileage/ArrivalDetector.swift | fixed before merge: fixes while parked, background updates, notification permission | – |
| 2026-10-21 | Interactive Entry Creation & Editing on Web Dashboard | not picked | projects/contempo/services/web/src/pages/EntriesPage.tsx:11 only reads entries; no insert/update functions exist | – | – |
