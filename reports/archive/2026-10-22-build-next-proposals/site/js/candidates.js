// heji-build-next, phase A: proposal review site for Voxbrief (2026-10-22)
(() => {
  const shot = (src, fit = "contain") => () => `<img class="shot" src="media/${src}" alt="" style="object-fit:${fit}">`;
  const idea = (kind, problem, plan) => () =>
    `<div class="keep" style="padding:40px;text-align:left;place-content:center start">` +
    `<small style="text-transform:uppercase;letter-spacing:.08em">${kind}</small>` +
    `<b style="font-size:26px;color:#222">${problem}</b><small>${plan}</small></div>`;
  const skip = (project, name) => ({
    id: `${project}-skip`, n: 0, name: `${name}: skip`, group: project,
    tagline: "Build nothing for this project this round", concept: "Nothing is built; the proposals stay as notes in this report.",
    facts: { Project: `projects/${project}`, Action: "Nothing built" },
    render: () => `<div class="keep"><b>Skip</b><small>${name} gets no build this round</small></div>`,
  });

  window.REVIEW = {
    key: "2026-10-22-build-next-proposals-v1",
    dir: "reports/archive/2026-10-22-build-next-proposals",
    repo: "tianhaoz95/hejitech-apps",
    port: 8803,
    project: "projects/voxbrief",
    context: ["CLAUDE.md", "projects/voxbrief/CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md (phase B, §3–§7)"],
    brief: "heji-build-next: 10 proposals for Voxbrief on 2026-10-22. Each proposal is grounded in today's code gaps on main @ ae27f58a and outside platform/library standards. Crown 🏆 the one to build and ♥ any others to build too; crown \"Skip\" to build nothing.",
    title: "Build proposals 2026-10-22",
    subtitle: "10 proposals for Voxbrief",
    heading: "Pick what to build",
    intro: "Nothing is built yet. Crown 🏆 the proposal to build, ♥ any others you want built as well (each gets its own branch), or crown <b>Skip</b>. Notes under a proposal change the plan. Then <b>Copy summary</b> and paste it back: the agent builds exactly your picks on local branches, captures them running and comes back with a second review to choose what to merge.<br><br><b>Target:</b> <code>projects/voxbrief</code> (native iOS + watchOS + macOS). Prior round (2026-10-21) merged 5 proposals into v1.28.0 (action item ticking, silence skipping, zip export, smart calendar dates, Mac capture hotkey; see <code>projects/voxbrief/build-next.md</code>).",
    legend: ["<b>1</b> project (Voxbrief)", "<b>10</b> proposals"],
    round: 1,
    frame: "card", size: [900, 620],
    modes: false,
    groups: [
      { id: "voxbrief", name: "Voxbrief", note: "projects/voxbrief" },
    ],
    nextSteps: ({ winners, groups }) => {
      const picked = winners.filter((c) => c.facts && c.facts.Kind);
      const skipped = groups.filter((g) => !picked.some((c) => c.group === g.id)).map((g) => g.name);
      return [
        "This is a heji-build-next **proposal** review (phase A done). You may be a different agent in a new session or another checkout: this hand-off is the whole brief. Each picked proposal below carries its plan (today's gap with file:line, the proposed change, files, risks, how to verify, what to capture, sources); the review site is committed at the path above (pull main) if you want the full text of the unpicked ones. Follow `.claude/skills/heji-build-next/SKILL.md` phase B (§3–§7): record the decisions in the ledgers, re-check each pick against today's main (the code may have moved since its `Checked on` commit), build the picks on local-only branches, verify, capture, then present the build review. The user's notes on a proposal override its text.", "",
        "**Build, per project:** every 🏆 winner below, plus every proposal marked ♥ shortlisted in that project's section (each on its own branch).",
        ...picked.map((c) => `- ${c.facts.Project}: ${c.name} (\`${c.id}\`), ${c.facts.Kind}, release ${c.facts.Release || "patch"}`), "",
        skipped.length ? `**Build nothing for:** ${skipped.join(", ")} (unless a proposal there is ♥ shortlisted).` : "",
        "Never push a heji-build branch, and put no code on main until the build hand-off comes back (the build branches stay in the checkout that built them, so that hand-off must return there).",
      ];
    },
    candidates: [
      skip("voxbrief", "Voxbrief"),
      {
        id: "voxbrief-multipage-pdf-export", n: 1, group: "voxbrief", name: "Multi-Page & macOS PDF Export with TextKit 2 Pagination",
        tagline: "Fix PDF export text truncation on iOS and blank PDF generation on macOS",
        concept: "PDFExportService.swift:54-95 hardcodes a single 612x792 pt page rect and calculates remainingHeight = pageRect.height - currentY - margin. When notes exceed ~2 paragraphs, all text beyond page 1 is clipped and permanently lost in the exported PDF. On macOS (lines 99-106), PDFExportService writes a blank PDFPage() directly with zero content because UIKit is unavailable. Users exporting long voice memos or using the Mac app receive clipped or empty PDFs.",
        moves: [
          "Implement a paginated text layout renderer loop using UIGraphicsPDFRenderer / PDFKit with automatic context.beginPage() page breaks",
          "Render multi-page headers, footers with page numbers ('Page X of Y'), title, and metadata on page 1",
          "Implement proper macOS PDF generation using NSAttributedString drawing and PDFDocument rather than an empty blank page",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Bug fix", Effort: "M",
          Evidence: "projects/voxbrief/VoxbriefApp/Services/PDFExportService.swift:84 clips note text to single page; lines 100-106 write a blank PDFPage on macOS",
          Release: "patch",
          Captures: "Exported PDF preview with multi-page note layout on iOS and non-blank rendered PDF on macOS",
          Sources: "https://developer.apple.com/documentation/uikit/uiprintpagerenderer",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Bug fix", "PDF export truncates notes longer than 1 page on iOS and writes empty blank PDFs on macOS", "Add multi-page pagination with TextKit / PDFDocument on both platforms"),
        spec: {
          today: ["PDFExportService.swift:84 clips note text to single page remainingHeight; lines 100-106 write a blank PDFPage on macOS."],
          proposed: ["Build a multi-page text layouter that breaks content across pages when remaining height is exceeded. On macOS, draw NSAttributedString into PDFKit pages."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/PDFExportService.swift",
            "projects/voxbrief/Tests/UnitTests/NoteDetailViewModelTests.swift",
          ],
          risks: ["Must handle edge cases where headings land right at page boundaries."],
          verify: ["Unit test exporting a multi-paragraph long note verifying generated PDF has >1 page and non-zero text length on both iOS and macOS."],
        },
      },
      {
        id: "voxbrief-biometric-lock", n: 2, group: "voxbrief", name: "Biometric Authentication (Face ID / Touch ID) for Locked Notes",
        tagline: "Secure private notes behind LocalAuthentication rather than just hiding title text",
        concept: "While VoiceNote.swift:281 has isLocked and NoteDetailView has a 'Lock Note (Privacy Shield)' menu item, tapping any locked note in NoteListView opens NoteDetailView and renders the full title, summary, cleaned markdown, audio player, and raw transcript in clear plain text! isLocked only changes the title in NoteRowView to 'Protected Note'. LocalAuthentication is not imported anywhere in the project, leaving locked notes completely exposed to anyone holding the device.",
        moves: [
          "Integrate LocalAuthentication (LAContext) to authenticate via Face ID, Touch ID, or device passcode",
          "Obscure locked note content in NoteDetailView with a blurred Privacy Shield overlay until authenticated",
          "Require authentication before opening or unlocking a locked note in NoteListView and NoteDetailView",
          "Keep locked notes secure when returning from background (scenePhase change)",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Security", Effort: "M",
          Evidence: "projects/voxbrief/Shared/Models/VoiceNote.swift:281 defines isLocked but NoteDetailView.swift:407 displays all content without LocalAuthentication check",
          Release: "minor",
          Captures: "Biometric authentication prompt sheet and blurred privacy shield on locked notes in NoteDetailView",
          Sources: "https://developer.apple.com/documentation/localauthentication",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Security", "Locked notes display all text and audio in plain text when opened without Face ID", "Guard locked notes with LocalAuthentication biometric challenge and blur shield"),
        spec: {
          today: ["NoteDetailView.swift:407 renders all note content unconditionally; LocalAuthentication is never called."],
          proposed: ["Add BiometricAuthService wrapping LAContext.evaluatePolicy(.deviceOwnerAuthentication); shield NoteDetailView with privacy overlay until unlocked."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/BiometricAuthService.swift",
            "projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift",
            "projects/voxbrief/VoxbriefApp/ViewModels/NoteDetailViewModel.swift",
          ],
          risks: ["Simulator fallback without enrolled biometrics must allow passcode or mock bypass in tests."],
          verify: ["Unit tests for auth state transitions; simulator verification with simulated Face ID."],
        },
      },
      {
        id: "voxbrief-interactive-waveform-scrubber", n: 3, group: "voxbrief", name: "Interactive Audio Waveform Scrubber for Note Playback",
        tagline: "Replace flat progress capsule with an audio amplitude waveform scrubber",
        concept: "In NoteDetailView.swift:785-805, the audio player bar is a 4px flat capsule. Unlike Apple Voice Memos or modern audio apps, users have zero visibility into where speech pauses, loud remarks, or quiet sections occur. Because WhisperKit and AVFoundation already record uncompressed or AAC audio, extracting 64 normalized amplitude levels allows rendering a beautiful, responsive sound wave bar that users can visually scrub through.",
        moves: [
          "Extract normalized audio amplitude samples (e.g. 64 bars) from audio files using AVAssetReader / AVAudioFile",
          "Cache amplitude samples on VoiceNote or on disk in AudioFileManager to avoid recalculating on every view appear",
          "Replace flat Capsule() in NoteDetailView with an interactive waveform component supporting drag seeking and played/unplayed gradients",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Evidence: "projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift:785-805 uses a 4px flat Capsule() with zero visual amplitude feedback",
          Release: "minor",
          Captures: "Interactive multi-bar amplitude waveform with gradient fill and drag scrubbing in NoteDetailView",
          Sources: "https://developer.apple.com/documentation/avfoundation/avassetreader",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Audio player is an uninformative flat 4px line with no sound wave visibility", "Render an interactive 64-bar amplitude waveform scrubber with drag seeking"),
        spec: {
          today: ["NoteDetailView.swift:785 renders a flat 4px Capsule() bar without waveform visualization."],
          proposed: ["Implement AudioWaveformExtractor generating [Float] levels from audio files; render interactive AudioWaveformScrubber in NoteDetailView."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/AudioWaveformExtractor.swift",
            "projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift",
            "projects/voxbrief/Shared/Models/VoiceNote.swift",
          ],
          risks: ["Audio files on disk must be read asynchronously so large memo waveforms don't hitch view loading."],
          verify: ["Unit test on sample m4a audio file verifying extracted sample count and normalized bounds [0.0, 1.0]."],
        },
      },
      {
        id: "voxbrief-corespotlight-indexing", n: 4, group: "voxbrief", name: "CoreSpotlight System Search Integration",
        tagline: "Index voice notes into iOS and Mac Spotlight with deep-link navigation",
        concept: "Voxbrief notes are completely invisible to iOS and macOS system Spotlight search. Users who capture ideas on Apple Watch cannot search for keywords from their iPhone Home Screen or Mac menu bar. Adding CoreSpotlight indexing connects Voxbrief directly to iOS search, Siri suggestions, and Shortcuts.",
        moves: [
          "Create NoteSpotlightIndexer to index ready notes into CSSearchableIndex with title, summary, tags, and transcript",
          "Automatically update or remove searchable items when notes are updated, archived, locked, or deleted",
          "Handle onContinueUserActivity(CSSearchableItemActionType) in VoxbriefApp to navigate directly to the selected note",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Evidence: "projects/voxbrief has zero occurrences of CSSearchableItem; NoteListViewModel.swift:65 uses naive in-memory contains scan",
          Release: "minor",
          Captures: "Spotlight search results displaying voice notes with audio duration badges and tap-to-open deep link",
          Sources: "https://developer.apple.com/documentation/corespotlight",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Voice notes cannot be searched or discovered from iOS or Mac Spotlight", "Index notes into CoreSpotlight with instant deep links into note detail"),
        spec: {
          today: ["CoreSpotlight is never imported; notes cannot be discovered outside the running app."],
          proposed: ["Implement NoteSpotlightIndexer using CSSearchableIndex.default(); register index updates in NoteRepository; handle continuation in VoxbriefApp."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/NoteSpotlightIndexer.swift",
            "projects/voxbrief/VoxbriefApp/Services/NoteRepository.swift",
            "projects/voxbrief/VoxbriefApp/App/VoxbriefApp.swift",
          ],
          risks: ["Locked notes must be excluded from public Spotlight index to preserve privacy."],
          verify: ["Unit test verifying searchable attribute set generation and index update calls on note save/delete."],
        },
      },
      {
        id: "voxbrief-watch-audio-playback", n: 5, group: "voxbrief", name: "Standalone Audio Playback on Apple Watch",
        tagline: "Listen to recorded voice memos directly on Apple Watch before syncing",
        concept: "On Apple Watch, WatchNotesListView lists recorded memos in the Vault, but users cannot listen to them! If a user dictates a reminder while jogging without their phone, they have no way to verify the recording was clear or check what they said until hours later when paired with iPhone.",
        moves: [
          "Create WatchAudioPlayer using AVAudioPlayer configured with AVAudioSession.setCategory(.playback)",
          "Add play/pause buttons and playback scrub/progress indicator to rows in WatchNotesListView",
          "Support playback over Apple Watch built-in speaker and Bluetooth AirPods",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Evidence: "projects/voxbrief/VoxbriefWatch/Views/WatchNotesListView.swift:57-89 renders memos as inert text rows with no playback action",
          Release: "minor",
          Captures: "WatchNotesListView with play/pause buttons, elapsed time counter, and active playback indicator",
          Sources: "https://developer.apple.com/documentation/watchkit/audio_playback_in_watchos",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Apple Watch vault lists audio memos but cannot play them back on wrist", "Add standalone AVAudioPlayer playback over watch speaker and AirPods"),
        spec: {
          today: ["WatchNotesListView.swift:57 lists notes with duration but provides no playback interaction."],
          proposed: ["Build WatchAudioPlayer managing AVAudioPlayer playback; add Play/Stop action and timeline progress in WatchNotesListView."],
          files: [
            "projects/voxbrief/VoxbriefWatch/Services/WatchAudioPlayer.swift",
            "projects/voxbrief/VoxbriefWatch/Views/WatchNotesListView.swift",
          ],
          risks: ["Audio session category must switch cleanly between .playAndRecord for recording and .playback for listening."],
          verify: ["Unit tests for WatchAudioPlayer playback lifecycle; simulator audio verification."],
        },
      },
      {
        id: "voxbrief-pause-resume-recording", n: 6, group: "voxbrief", name: "Pause and Resume Audio Recording on iPhone",
        tagline: "Pause active recordings during interruptions without restarting or discarding",
        concept: "In AudioRecordingService.swift on iOS, isRecording is strictly binary. If an interruption occurs (someone walks into the room, phone call alert, or need to cough), the user can only stop the note early or cancel it entirely. Meanwhile, WatchAudioRecorder.swift:85 on watchOS already has pauseRecording() and resumeRecording(). iPhone users need parity.",
        moves: [
          "Add isPaused property, pauseRecording(), and resumeRecording() to AudioRecordingService.swift",
          "Update RecordingCoordinator to route pause and resume actions",
          "Add a Pause/Resume button alongside the waveform in QuickRecordSheet and freeze waveform level while paused",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "S",
          Evidence: "projects/voxbrief/VoxbriefApp/Services/AudioRecordingService.swift:54 lacks isPaused/pauseRecording, while WatchAudioRecorder.swift:85 already has it",
          Release: "patch",
          Captures: "QuickRecordSheet displaying Pause/Resume button and paused waveform badge during active recording",
          Sources: "https://developer.apple.com/documentation/avfoundation/avaudiorecorder/1388040-pause",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Quality", "iPhone recording cannot be paused during interruptions without ending the memo", "Add pause/resume controls in AudioRecordingService matching watchOS"),
        spec: {
          today: ["AudioRecordingService.swift:54 has only startRecording, stopRecording, and cancelRecording."],
          proposed: ["Add isPaused state and call audioRecorder.pause() / audioRecorder.record(); wire Pause button in QuickRecordSheet."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/AudioRecordingService.swift",
            "projects/voxbrief/VoxbriefApp/Services/RecordingCoordinator.swift",
            "projects/voxbrief/VoxbriefApp/Views/QuickRecordSheet.swift",
          ],
          risks: ["Recording duration timer must pause when isPaused is true so recorded duration remains accurate."],
          verify: ["Unit test starting recording, pausing for 0.5s, resuming, stopping, and verifying duration excludes paused time."],
        },
      },
      {
        id: "voxbrief-smart-reminders-export", n: 7, group: "voxbrief", name: "Smart Priority & Due-Date Extraction for Apple Reminders Export",
        tagline: "Filter completed items and attach priorities and due dates to exported Reminders",
        concept: "RemindersExportService.swift:57 unconditionally exports all actionItems with zero priority and no due dates. Even if an item is already checked off in completedActionItems, it gets exported as an uncompleted reminder. Furthermore, spoken dates ('submit expenses by Friday 5pm') and LLM-detected priorities (VoiceNote.actionItemPriorities: ['high', 'medium', 'low']) are completely discarded.",
        moves: [
          "Filter out already completed items in completedActionItems from the export list",
          "Map actionItemPriorities ('high' -> 1, 'medium' -> 5, 'low' -> 9) into EKReminder.priority",
          "Use CalendarExportService.detectDate(in:) to set reminder.dueDateComponents and an alarm if a date or time is detected",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "S",
          Evidence: "projects/voxbrief/VoxbriefApp/Services/RemindersExportService.swift:57 ignores VoiceNote.completedActionItems, actionItemPriorities, and spoken dates",
          Release: "patch",
          Captures: "Apple Reminders export confirmation showing priority flags and due dates matching voice note action items",
          Sources: "https://developer.apple.com/documentation/eventkit/ekreminder",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Quality", "Reminders export dumps all items with zero priority, no due dates, including completed items", "Filter out completed items, assign priority, and extract spoken due dates"),
        spec: {
          today: ["RemindersExportService.swift:65-72 creates bare EKReminder without dueDateComponents or priority, ignoring completedActionItems."],
          proposed: ["Update exportActionItems to accept VoiceNote, filter completed items, assign priority, and extract dueDateComponents."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/RemindersExportService.swift",
            "projects/voxbrief/VoxbriefApp/ViewModels/NoteDetailViewModel.swift",
          ],
          risks: ["Must handle permission denial gracefully if full Reminders access is restricted."],
          verify: ["Unit test with mock note containing completed items, high priority action items, and date string, checking reminder properties."],
        },
      },
      {
        id: "voxbrief-mac-audio-import-drag-drop", n: 8, group: "voxbrief", name: "Audio File Import and Drag-and-Drop on macOS",
        tagline: "Drop audio files onto the Mac desktop window to transcribe and clean them",
        concept: "On iOS, users can import audio recordings and lectures via AudioImportService and the file importer. On macOS, AudioImportService is completely excluded from the target, and NotesBrowserView provides no way to import audio or drag-and-drop voice memo files into the app. Desktop users cannot transcribe recorded Zoom meetings or downloaded voice memos.",
        moves: [
          "Add AudioImportService.swift to VoxbriefMac sources in project.yml",
          "Add an 'Import Audio File…' action to the toolbar and File menu in VoxbriefMacApp",
          "Add .onDrop(of: [.audio, .movie], isTargeted: $isDropTargeted) to NotesBrowserView to transcribe dropped files immediately",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Evidence: "projects/voxbrief/project.yml:310 omits AudioImportService.swift from VoxbriefMac; NotesBrowserView.swift has no import or drop handlers",
          Release: "minor",
          Captures: "NotesBrowserView with visual drop target overlay and 'Import Audio File…' menu bar / toolbar command",
          Sources: "https://developer.apple.com/documentation/swiftui/view/ondrop(of:istargeted:perform:)-5w5e3",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Feature", "Mac companion app cannot import external audio or accept dropped audio files", "Support AudioImportService on Mac with native drag-and-drop file imports"),
        spec: {
          today: ["AudioImportService is not compiled for Mac; NotesBrowserView lacks drop and import controls."],
          proposed: ["Compile AudioImportService for Mac; wire NSOpenPanel import and SwiftUI onDrop in NotesBrowserView."],
          files: [
            "projects/voxbrief/project.yml",
            "projects/voxbrief/VoxbriefApp/Services/AudioImportService.swift",
            "projects/voxbrief/VoxbriefMac/Views/NotesBrowserView.swift",
            "projects/voxbrief/VoxbriefMac/App/VoxbriefMacApp.swift",
          ],
          risks: ["Security-scoped file access for dropped URLs on macOS must be started and stopped properly."],
          verify: ["Unit test for AudioImportService on macOS target; drag-and-drop test with sample audio URL."],
        },
      },
      {
        id: "voxbrief-recently-deleted-trash", n: 9, group: "voxbrief", name: "Recently Deleted Trash with 30-Day Recovery",
        tagline: "Soft-delete notes to prevent accidental irreversible data loss of audio memos",
        concept: "When a user deletes a note in NoteRowView or NoteDetailView, NoteRepository.swift:61 immediately unlinks the audio file from disk and deletes the record. Accidental deletions or swipe gestures immediately destroy irreplaceable voice recordings forever with zero recovery mechanism.",
        moves: [
          "Add deletedAt: Date? to VoiceNote (or soft-delete flag) with 30-day retention",
          "Update NoteRepository.delete to move to trash (soft-delete), and add purgeRecentlyDeleted() / permanentlyDelete(id:)",
          "Add a 'Recently Deleted' folder/sheet in NoteListView where users can restore notes or empty trash",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "M",
          Evidence: "projects/voxbrief/VoxbriefApp/Services/NoteRepository.swift:53-66 immediately deletes audio files and removes notes permanently with no undo or trash",
          Release: "minor",
          Captures: "Recently Deleted view in NoteListView with 'Recover' and 'Delete Immediately' actions",
          Sources: "https://developer.apple.com/design/human-interface-guidelines/patterns/deleting-data",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Quality", "Deleting a voice note permanently and irreversibly destroys audio with no undo", "Add 30-day Recently Deleted bin with restore and permanent purge actions"),
        spec: {
          today: ["NoteRepository.swift:53 immediately wipes files and records on delete."],
          proposed: ["Add deletedAt timestamp on VoiceNote; update delete(id:) to soft-delete; add restore(id:) and purgeOldDeletedNotes()."],
          files: [
            "projects/voxbrief/Shared/Models/VoiceNote.swift",
            "projects/voxbrief/VoxbriefApp/Services/NoteRepository.swift",
            "projects/voxbrief/VoxbriefApp/ViewModels/NoteListViewModel.swift",
            "projects/voxbrief/VoxbriefApp/Views/NoteListView.swift",
          ],
          risks: ["Disk storage: notes older than 30 days must be automatically pruned so storage doesn't grow unbounded."],
          verify: ["Unit test deleting note, verifying it is excluded from active notes, restoring it, and verifying permanent purge."],
        },
      },
      {
        id: "voxbrief-markdown-extended-blocks", n: 10, group: "voxbrief", name: "Extended Markdown Rendering (H2 Headings, Dividers & Code Blocks)",
        tagline: "Render ## headings, horizontal rules, and code blocks properly in MarkdownLiteText",
        concept: "MarkdownLiteText.swift:48-60 checks line.hasPrefix('### ') and line.hasPrefix('# '), but completely skips '## ' (Level 2 headings)! When user edits, imported markdown, or custom LLM templates produce '## Key Takeaways', it falls through to plain body text and shows literal '## '. Furthermore, horizontal dividers ('---') and fenced code blocks are rendered as raw characters.",
        moves: [
          "Add line.hasPrefix('## ') handling in MarkdownLiteText rendered as .font(.title3.bold())",
          "Add horizontal rule ('---', '***') rendered as a subtle Divider()",
          "Add fenced code block (```) support rendered in a formatted monospaced container",
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "S",
          Evidence: "projects/voxbrief/VoxbriefApp/Views/MarkdownLiteText.swift:48-60 supports # and ### but skips ## entirely; horizontal rules and code blocks render as raw text",
          Release: "patch",
          Captures: "NoteDetailView rendered note showing clean ## section headers, divider lines, and monospaced code blocks",
          Sources: "https://commonmark.org/help/",
          "Checked on": "main @ ae27f58a",
        },
        render: idea("Quality", "MarkdownLiteText skips ## headings, dividers, and code blocks, rendering them as raw text", "Add Level 2 headings, dividers, and fenced code block syntax parsing"),
        spec: {
          today: ["MarkdownLiteText.swift:48-60 omits ## prefix and code block parsing."],
          proposed: ["Add ## heading case, divider line detection, and multiline code block state in MarkdownLiteText."],
          files: [
            "projects/voxbrief/VoxbriefApp/Views/MarkdownLiteText.swift",
            "projects/voxbrief/Tests/UnitTests/MarkdownLiteTextTests.swift",
          ],
          risks: ["Must preserve checklist button interactive toggling without altering line index mapping."],
          verify: ["Unit tests in MarkdownLiteTextTests with ##, ---, and code block markdown verifying rendered components."],
        },
      },
    ],
  };
})();
