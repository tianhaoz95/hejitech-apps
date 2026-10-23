# Build-next ledger

Ideas heji-build-next proposed for this project and what the owner decided. The skill reads this
before proposing (see .claude/skills/heji-build-next/SKILL.md, "The ledger"). Newest first.

| Date | Idea | Outcome | Evidence | Why / owner's note | Revisit if |
|---|---|---|---|---|---|
| 2026-10-22 | Biometric Authentication for Locked Notes | merged in 1.29.0 | projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift:407 | – | – |
| 2026-10-22 | Pause and Resume Audio Recording on iPhone | merged in 1.29.0 | projects/voxbrief/VoxbriefApp/Services/AudioRecordingService.swift:54 | – | – |
| 2026-10-22 | Recently Deleted Trash with 30-Day Recovery | kept main after build | projects/voxbrief/VoxbriefApp/Services/NoteRepository.swift:80 | – | – |
| 2026-10-22 | CoreSpotlight System Search Integration | kept main after build | CSSearchableIndex | – | – |
| 2026-10-22 | Audio File Import & Drag-and-Drop on macOS | kept main after build | projects/voxbrief/VoxbriefMac/App/VoxbriefMacApp.swift | – | – |
| 2026-10-22 | Standalone Audio Playback on Apple Watch | kept main after build | projects/voxbrief/VoxbriefWatch/Views/WatchNotesListView.swift:57 | – | – |
| 2026-10-22 | Smart Priority & Due-Date Extraction for Reminders Export | kept main after build | projects/voxbrief/VoxbriefApp/Services/RemindersExportService.swift:34 | – | – |
| 2026-10-22 | Extended Markdown Rendering (H2, Dividers, Code Blocks) | kept main after build | projects/voxbrief/VoxbriefApp/Views/MarkdownLiteText.swift:15 | – | – |
| 2026-10-22 | Multi-Page & macOS PDF Export with TextKit 2 Pagination | not picked | projects/voxbrief/VoxbriefApp/Services/PDFExportService.swift:84 | – | – |
| 2026-10-22 | Interactive Audio Waveform Scrubber for Note Playback | not picked | projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift:785-805 | – | – |
| 2026-10-21 | Tap to check off action items | merged in 1.28.0 | VoxbriefApp/Views/MarkdownLiteText.swift | fixed before merge: keeps completedActionItems in step | – |
| 2026-10-21 | Skip silences during playback | merged in 1.28.0 | VoxbriefApp/Services/AudioPlaybackService.swift | – | – |
| 2026-10-21 | Export all notes as a zip | merged in 1.28.0 | VoxbriefApp/Services/NoteExportService.swift exportNotesAsZip | fixed before merge: built on share, locked notes left out | – |
| 2026-10-21 | Calendar export picks the date from the note | merged in 1.28.0 | VoxbriefApp/Services/CalendarExportService.swift detectDate | fixed before merge: tests compile, upcoming dates only | – |
| 2026-10-21 | Custom capture hotkey (Mac) | merged in 1.28.0 | VoxbriefMac/Models/CaptureShortcut.swift | – | – |
