// heji-build-next, phase B/C: Voxbrief (2026-10-22) build review record.
// Merged builds: pause-resume-recording and biometric-lock.
(() => {
  const shot = (src, fit = "cover") => () => `<img class="shot" src="media/${src}" alt="" style="object-fit:${fit}">`;
  const notMerged = () => `<div class="keep"><b>Not merged</b><small>Kept main after build</small></div>`;
  const log = (src) => ({
    name: "Evidence log",
    frame: "card",
    size: [900, 640],
    render: () => `<iframe class="log" src="media/${src}"></iframe>`
  });

  const keepMain = (project, name, today) => ({
    id: `${project}-main`, n: 0, name: `${name}: keep main`, group: project,
    tagline: "Don't merge anything for this project", concept: today,
    facts: { Project: `projects/${project}`, Action: "Nothing merged, the build branches are deleted" },
    render: () => `<div class="keep"><b>Keep main</b><small>${name} ships nothing this round</small></div>`,
  });

  const base = "main @ ae27f58a";

  window.REVIEW = {
    key: "2026-10-22-build-next-voxbrief-v3",
    dir: "reports/archive/2026-10-22-build-next-voxbrief",
    repo: "tianhaoz95/hejitech-apps",
    port: 8808,
    project: "projects/voxbrief",
    context: ["CLAUDE.md", "projects/voxbrief/CLAUDE.md", ".claude/skills/heji-build-next/SKILL.md (phase C, §8)"],
    brief: "heji-build-next: 8 builds for Voxbrief on 2026-10-22. Verified with real simulator captures, unit tests, and build logs. Shortlisted builds (pause-resume-recording, biometric-lock) merged into main.",
    title: "Build review: 2026-10-22 — Voxbrief",
    subtitle: "8 verified builds for Voxbrief (2 merged)",
    heading: "Pick what to merge",
    intro: "Two shortlisted builds (Pause and Resume Recording, Biometric Lock) were merged into main. The remaining 6 builds were kept on main and their temporary build branches cleaned up.",
    legend: ["<b>1</b> project (Voxbrief)", "<b>2</b> merged builds", "<b>6</b> kept main"],
    round: 2,
    frame: "card",
    size: [900, 620],
    modes: false,
    groups: [
      { id: "voxbrief", name: "Voxbrief", note: "projects/voxbrief · iOS + watchOS + macOS" },
    ],
    nextSteps: ({ winners, groups }) => {
      const merge = winners.filter((c) => c.facts && c.facts.Branch);
      const skip = groups.filter((g) => !merge.some((c) => c.group === g.id)).map((g) => g.name);
      return [
        "This is a heji-build-next **build** review (phase B done): every candidate below is already built and verified on a local-only branch in this checkout. Follow `.claude/skills/heji-build-next/SKILL.md` phase C (§8: merge, clean up, push, release). Also merge any build marked ♥ shortlisted in the sections below.", "",
        merge.length ? "**Merge into main (in this order):**" : "**Nothing picked to merge.** Still clean up the build branches (§8 step 3).",
        ...merge.map((c) => `- ${c.facts.Project}: \`${c.facts.Branch}\` (head \`${c.facts.Commit}\`), ${c.name}; release: ${c.facts.Release || "patch"}`), "",
        skip.length ? `**Not merged (branch deleted, nothing released):** ${skip.join(", ")}.` : "",
        "Then: delete every `heji-build/*` branch and worktree (`.claude/skills/heji-build-next/worktree.sh cleanup`), push main, wait for CI to go green, and cut release with `scripts/cut_release.sh voxbrief <level> --notes \"…\" --watch` (dry run first). Never push a heji-build branch.",
      ];
    },
    candidates: [
      keepMain("voxbrief", "Voxbrief", "Voxbrief on main @ ae27f58a: speech notes with AI summaries, watch complication capture, calendar export, Mac capture hotkey."),

      // ── BUILD 1: Pause and Resume Audio Recording on iPhone ─────────────────
      {
        id: "voxbrief-pause-resume-recording", n: 1, group: "voxbrief",
        name: "Pause and Resume Audio Recording on iPhone",
        tagline: "Pause active recordings during interruptions without restarting or discarding",
        concept: "Adds isPaused state, pauseRecording(), and resumeRecording() to AudioRecordingService and RecordingCoordinator on iOS, matching existing watchOS capabilities, with pause/resume button and paused badge in QuickRecordSheet.",
        moves: [
          "Add isPaused, pauseRecording(), and resumeRecording() to AudioRecordingService.swift",
          "Route pause and resume actions through RecordingCoordinator.swift",
          "Render Pause/Resume button and 'PAUSED' badge in QuickRecordSheet.swift"
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "S",
          Branch: "heji-build/2026-10-22-voxbrief-pause-resume-recording", Commit: "cc3f5230", Base: base,
          Diff: "7 files changed, 105 insertions(+), 10 deletions(-)",
          Tests: "xcodebuild test: 3 tests, 0 failures (3 new in AudioRecordingServicePauseTests)",
          Release: "patch",
          Captured: "iPhone 16 simulator, iOS 18.6, launched with -has_completed_onboarding YES -voxbriefScreen record -voxbriefSimulateRecording",
        },
        render: shot("voxbrief/pause-resume-recording-after.png", "contain"),
        views: [
          { name: "Before (main)", frame: "phone", render: shot("voxbrief/pause-resume-recording-before.png") },
          { name: "After (this branch)", frame: "phone", render: shot("voxbrief/pause-resume-recording-after.png") },
          log("voxbrief/pause-resume-recording.log")
        ],
        spec: {
          today: ["AudioRecordingService.swift lacked pause support, while WatchAudioRecorder already had pauseRecording()/resumeRecording()."],
          proposed: ["Add isPaused, pauseRecording(), resumeRecording() to AudioRecordingService; wire RecordingCoordinator and QuickRecordSheet button."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/AudioRecordingService.swift",
            "projects/voxbrief/VoxbriefApp/Services/RecordingCoordinator.swift",
            "projects/voxbrief/VoxbriefApp/Views/QuickRecordSheet.swift"
          ],
          risks: ["Ensure audio metering timer suspends or clamps level to zero while paused."],
          verify: ["Built full iOS app scheme Voxbrief and executed AudioRecordingServicePauseTests with 3 passing tests."]
        }
      },

      // ── BUILD 2: Extended Markdown Rendering ───────────────────────────────
      {
        id: "voxbrief-markdown-extended-blocks", n: 2, group: "voxbrief",
        name: "Extended Markdown Rendering (H2, Dividers, Code Blocks)",
        tagline: "Render ## subheadings, horizontal rules, and fenced code blocks in AI summaries",
        concept: "Extends MarkdownLiteText beyond basic bullet points to parse and display H2 section headers, horizontal divider lines (--- / ***), and styled monospace code blocks with subtle fill backgrounds.",
        moves: [
          "Parse lines starting with '## ' into styled headline text blocks",
          "Detect divider lines ('---', '***') and render thin semantic dividers",
          "Support fenced code blocks (``` ... ```) with monospace font and container background"
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Quality", Effort: "S",
          Action: "Kept main after build"
        },
        render: notMerged,
        views: [],
        spec: {
          today: ["MarkdownLiteText only parsed H1 headers (#) and basic bullet checklists; code fences, dividers, and H2 headers were dumped as plain text."],
          proposed: ["Add MarkdownBlock enum cases for h2, divider, and code; tokenize blocks sequentially with code fence state machine."],
          files: [
            "projects/voxbrief/VoxbriefApp/Views/MarkdownLiteText.swift",
            "projects/voxbrief/Tests/UnitTests/MarkdownLiteTextTests.swift",
            "projects/voxbrief/Tests/MacUnitTests/MarkdownLiteTextMacTests.swift"
          ],
          risks: ["Avoid regex catastrophic backtracking on long multiline code blocks."],
          verify: ["Executed MarkdownLiteTextTests covering 7 test cases with 0 failures."]
        }
      },

      // ── BUILD 3: Smart Reminders Export ─────────────────────────────────────
      {
        id: "voxbrief-smart-reminders-export", n: 3, group: "voxbrief",
        name: "Smart Priority & Due-Date Extraction for Reminders Export",
        tagline: "Infer high/medium/low priority and date deadlines when exporting action items to Reminders",
        concept: "Scans action item strings for urgency indicators (urgent, ASAP, critical) and date cues (tomorrow, today, by Friday) to populate EKReminder.priority and EKReminder.dueDateComponents, while excluding completed items.",
        moves: [
          "Parse priority levels (high, medium, low) from action item keywords",
          "Extract relative and weekday due dates using natural language heuristics",
          "Exclude already-checked action items from bulk reminder export"
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Action: "Kept main after build"
        },
        render: notMerged,
        views: [],
        spec: {
          today: ["RemindersExportService created plain reminders with no priority or due date, and included completed action items unconditionally."],
          proposed: ["Add natural language parser for urgency and date extraction; filter out completedActionItems."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/RemindersExportService.swift",
            "projects/voxbrief/VoxbriefApp/ViewModels/NoteDetailViewModel.swift",
            "projects/voxbrief/Tests/UnitTests/RemindersExportServiceTests.swift",
            "projects/voxbrief/Tests/MacUnitTests/RemindersExportServiceMacTests.swift"
          ],
          risks: ["Timezone assumptions when resolving relative dates like 'tomorrow'."],
          verify: ["Ran RemindersExportServiceTests with 2 tests passing in 0.003s."]
        }
      },

      // ── BUILD 4: Standalone Audio Playback on Apple Watch ───────────────────
      {
        id: "voxbrief-watch-audio-playback", n: 4, group: "voxbrief",
        name: "Standalone Audio Playback on Apple Watch",
        tagline: "Listen to recorded voice memos directly on Apple Watch before syncing to iPhone",
        concept: "Implements WatchAudioPlayer wrapping AVAudioPlayer with AVAudioSession playback category, and integrates play/stop button with timeline progress into WatchNotesListView.",
        moves: [
          "Create WatchAudioPlayer with AVAudioPlayer playback lifecycle",
          "Add Play/Stop buttons and playback progress scrubber in WatchNotesListView",
          "Switch AVAudioSession cleanly between .playAndRecord and .playback"
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Action: "Kept main after build"
        },
        render: notMerged,
        views: [],
        spec: {
          today: ["WatchNotesListView displayed memo titles and durations but provided no playback controls."],
          proposed: ["Add WatchAudioPlayer managing AVAudioPlayer and AVAudioSession; wire toggle playback buttons and elapsed time in list rows."],
          files: [
            "projects/voxbrief/VoxbriefWatch/Services/WatchAudioPlayer.swift",
            "projects/voxbrief/VoxbriefWatch/Views/WatchNotesListView.swift",
            "projects/voxbrief/Voxbrief.xcodeproj/project.pbxproj"
          ],
          risks: ["Audio session category contention with active WatchAudioRecorder."],
          verify: ["Built VoxbriefWatch scheme targeting watchOS simulator and generic watchOS platform with 0 errors."]
        }
      },

      // ── BUILD 5: Audio File Import & Drag-and-Drop on macOS ─────────────────
      {
        id: "voxbrief-mac-audio-import-drag-drop", n: 5, group: "voxbrief",
        name: "Audio File Import & Drag-and-Drop on macOS",
        tagline: "Drop external audio files (m4a, wav, mp3) into Voxbrief Mac to create notes and transcribe",
        concept: "Adds dropDestination(for: URL.self) on macOS NotesBrowserView with AudioImportService validation, enabling users to drag audio recordings directly from Finder or Desktop into Voxbrief.",
        moves: [
          "Implement AudioImportService to validate and copy dropped audio files",
          "Attach .dropDestination(for: URL.self) on NotesBrowserView in VoxbriefMac",
          "Trigger automatic transcription and note creation for dropped recordings"
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Action: "Kept main after build"
        },
        render: notMerged,
        views: [],
        spec: {
          today: ["VoxbriefMac only supported microphone recording; no mechanism existed to import existing voice memos or meeting recordings."],
          proposed: ["Add dropDestination modifier and AudioImportService to process dragged audio files into VoiceNote pipeline."],
          files: [
            "projects/voxbrief/VoxbriefMac/Views/NotesBrowserView.swift",
            "projects/voxbrief/Tests/MacUnitTests/AudioImportServiceMacTests.swift",
            "projects/voxbrief/project.yml"
          ],
          risks: ["Handling large multi-hundred megabyte audio files without blocking main thread."],
          verify: ["Ran AudioImportServiceMacTests verifying supported audio extensions and drop handling with 0 failures."]
        }
      },

      // ── BUILD 6: CoreSpotlight System Search Integration ───────────────────
      {
        id: "voxbrief-corespotlight-indexing", n: 6, group: "voxbrief",
        name: "CoreSpotlight System Search Integration",
        tagline: "Index voice notes into iOS and Mac Spotlight with deep-link navigation and privacy checks",
        concept: "Implements NoteSpotlightIndexer using CSSearchableIndex to index note titles, summaries, tags, and transcripts, with automatic exclusion of locked notes and deep-link continuation via onContinueUserActivity.",
        moves: [
          "Create NoteSpotlightIndexer to populate CSSearchableItem attributes",
          "Exclude locked notes from indexing to protect user privacy",
          "Handle CSSearchableItemActionType deep links in VoxbriefApp and NoteListView"
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Action: "Kept main after build"
        },
        render: notMerged,
        views: [],
        spec: {
          today: ["CoreSpotlight was not imported anywhere in the project; notes could only be found within the app's in-memory search bar."],
          proposed: ["Implement NoteSpotlightIndexer; connect index updates to NoteRepository; register onContinueUserActivity in VoxbriefApp."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/NoteSpotlightIndexer.swift",
            "projects/voxbrief/VoxbriefApp/Services/NoteRepository.swift",
            "projects/voxbrief/VoxbriefApp/App/VoxbriefApp.swift",
            "projects/voxbrief/VoxbriefApp/Views/NoteListView.swift",
            "projects/voxbrief/Tests/MacUnitTests/NoteSpotlightIndexerMacTests.swift"
          ],
          risks: ["Ensuring locked notes never leak into Spotlight search index."],
          verify: ["Ran NoteSpotlightIndexerMacTests covering item generation, privacy exclusions, and deletion in 0.006s."]
        }
      },

      // ── BUILD 7: Recently Deleted Trash with 30-Day Recovery ───────────────
      {
        id: "voxbrief-recently-deleted-trash", n: 7, group: "voxbrief",
        name: "Recently Deleted Trash with 30-Day Recovery",
        tagline: "Two-stage deletion with 30-day recovery retention preventing accidental data loss",
        concept: "Adds deletedAt timestamp and isDeleted property to VoiceNote, converting note deletion into a reversible soft-delete with 30-day expiration purge and trash restoration capabilities in NoteRepository and NoteListViewModel.",
        moves: [
          "Add deletedAt timestamp property to VoiceNote model",
          "Convert delete() to soft delete and add restore(id:) and purgeExpiredTrash()",
          "Expose trash filtering and item count in NoteListViewModel"
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Feature", Effort: "M",
          Action: "Kept main after build"
        },
        render: notMerged,
        views: [],
        spec: {
          today: ["Note deletion immediately purged notes and audio from disk without any confirmation or recovery window."],
          proposed: ["Add deletedAt property; implement soft-delete, restore, and 30-day purge in NoteRepository."],
          files: [
            "projects/voxbrief/Shared/Models/VoiceNote.swift",
            "projects/voxbrief/VoxbriefApp/Services/NoteRepository.swift",
            "projects/voxbrief/VoxbriefApp/ViewModels/NoteListViewModel.swift",
            "projects/voxbrief/Tests/MacUnitTests/RecentlyDeletedTrashMacTests.swift"
          ],
          risks: ["Audio files must be preserved in trash and only purged upon permanent deletion."],
          verify: ["Ran RecentlyDeletedTrashMacTests covering soft-delete, restore, and 30-day purge in 0.006s."]
        }
      },

      // ── BUILD 8: Biometric Authentication for Locked Notes ─────────────────
      {
        id: "voxbrief-biometric-lock", n: 8, group: "voxbrief",
        name: "Biometric Authentication (Face ID / Touch ID) for Locked Notes",
        tagline: "Secure private notes behind LocalAuthentication rather than just hiding title text",
        concept: "Integrates BiometricAuthService wrapping LocalAuthentication LAContext to protect locked notes with a blurred Privacy Shield overlay until authenticated, re-locking automatically when backgrounded.",
        moves: [
          "Implement BiometricAuthService wrapping LAContext.evaluatePolicy(.deviceOwnerAuthentication)",
          "Cover NoteDetailView with blurred Privacy Shield overlay until authenticated",
          "Re-lock automatically when scenePhase changes to background"
        ],
        facts: {
          Project: "projects/voxbrief", Kind: "Security", Effort: "M",
          Branch: "heji-build/2026-10-22-voxbrief-biometric-lock", Commit: "69366415", Base: base,
          Diff: "5 files changed, 174 insertions(+), 5 deletions(-)",
          Tests: "xcodebuild test: 2 tests, 0 failures (2 new in BiometricAuthServiceMacTests)",
          Release: "minor",
          Captured: "iPhone 16 simulator, iOS 18.6, launched with -has_completed_onboarding YES -voxbriefScreen detail -voxbriefLockNote",
        },
        render: shot("voxbrief/biometric-lock-after.png", "contain"),
        views: [
          { name: "Before (main)", frame: "phone", render: shot("voxbrief/biometric-lock-before.png") },
          { name: "After (this branch)", frame: "phone", render: shot("voxbrief/biometric-lock-after.png") },
          log("voxbrief/biometric-lock.log")
        ],
        spec: {
          today: ["NoteDetailView rendered all note contents unconditionally; isLocked only masked the note title in NoteRowView without any auth check."],
          proposed: ["Add BiometricAuthService; shield NoteDetailView with privacy shield overlay and blur until unlocked."],
          files: [
            "projects/voxbrief/VoxbriefApp/Services/BiometricAuthService.swift",
            "projects/voxbrief/VoxbriefApp/Views/NoteDetailView.swift",
            "projects/voxbrief/Tests/MacUnitTests/BiometricAuthServiceMacTests.swift",
            "projects/voxbrief/project.yml"
          ],
          risks: ["Simulator fallback without biometrics must allow passcode or mock authentication."],
          verify: ["Captured Privacy Shield on iPhone 16 simulator; executed BiometricAuthServiceMacTests with 2 passing tests."]
        }
      }
    ]
  };
})();
