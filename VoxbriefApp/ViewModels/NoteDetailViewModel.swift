import Foundation
import Combine

@MainActor
public final class NoteDetailViewModel: ObservableObject {
    @Published public var note: VoiceNote
    @Published public var selectedTab: DetailTab = .cleanedNote
    @Published public var isReprocessing: Bool = false
    @Published public var isEditing: Bool = false
    @Published public var editedTitle: String = ""
    @Published public var editedCleanedNote: String = ""
    @Published public private(set) var isGeneratingLightCleanup: Bool = false
    
    public enum DetailTab: String, CaseIterable, Identifiable {
        case cleanedNote = "Full Rewrite"
        case lightCleanup = "Light Cleanup"
        case rawTranscript = "Raw Transcript"
        case pipeline = "2-Stage Pipeline"

        public var id: String { rawValue }

        /// Every tab except `.lightCleanup` when the light-rewrite feature is turned off in
        /// Settings/Preferences -- see `NoteProcessingPipeline.isLightCleanupEnabled`.
        public static var visible: [DetailTab] {
            NoteProcessingPipeline.isLightCleanupEnabled ? allCases : allCases.filter { $0 != .lightCleanup }
        }

        /// SF Symbol shown in the segmented tab bar; `rawValue` is used as its accessibility
        /// label instead.
        public var iconName: String {
            switch self {
            case .cleanedNote: return "doc.plaintext"
            case .lightCleanup: return "wand.and.stars"
            case .rawTranscript: return "waveform"
            case .pipeline: return "gearshape.2"
            }
        }
    }
    
    private let repository: NoteRepository
    private let pipeline: NoteProcessingPipeline
    public let playbackService: AudioPlaybackService
    
    private var cancellables = Set<AnyCancellable>()
    
    public init(
        note: VoiceNote,
        initialTab: DetailTab = .cleanedNote,
        repository: NoteRepository = .shared,
        pipeline: NoteProcessingPipeline = .shared,
        playbackService: AudioPlaybackService = .shared
    ) {
        self.note = note
        self.selectedTab = initialTab
        self.repository = repository
        self.pipeline = pipeline
        self.playbackService = playbackService
        
        repository.$notes
            .sink { [weak self] allNotes in
                guard let self = self else { return }
                if let updated = allNotes.first(where: { $0.id == self.note.id }) {
                    self.note = updated
                }
            }
            .store(in: &cancellables)
    }
    
    public var hasAudio: Bool {
        guard let fileName = note.audioFileName else { return false }
        return AudioFileManager.shared.fileExists(fileName: fileName)
    }

    /// True when this note's Stage 2 cleanup ran on the deterministic rule-based transformer
    /// because neither Ollama nor the on-device LLM was available -- surfaced in the UI so a
    /// degraded result is visible rather than looking identical to a full LLM cleanup.
    public var usedFallbackCleanup: Bool {
        note.cleanupEngine == CleanupEngineLabel.ruleBased
    }

    /// Same as `usedFallbackCleanup`, for the light rewrite shown on its own tab.
    public var usedFallbackCleanupLight: Bool {
        note.lightCleanupEngine == CleanupEngineLabel.ruleBased
    }

    public func togglePlayback() {
        guard let fileName = note.audioFileName else { return }
        playbackService.play(fileName: fileName)
    }

    /// Plays (or toggles pause/resume on) a specific segment's audio file, for the multi-recording
    /// list shown when a note has more than one segment. `AudioPlaybackService.play` already
    /// toggles pause/resume when asked to play whatever's currently loaded.
    public func togglePlayback(fileName: String) {
        playbackService.play(fileName: fileName)
    }

    public func seek(to progress: Double) {
        guard let fileName = note.audioFileName else { return }
        if playbackService.currentlyPlayingFileName != fileName {
            playbackService.play(fileName: fileName)
            playbackService.pause()
        }
        playbackService.seek(to: progress)
    }

    public func seek(toTime time: TimeInterval) {
        guard let fileName = note.audioFileName else { return }
        playbackService.play(fileName: fileName, startingAt: time)
    }

    @discardableResult
    public func cyclePlaybackRate() -> Float {
        playbackService.cyclePlaybackRate()
    }

    public func exportActionItemsToReminders() async throws -> Int {
        try await RemindersExportService.shared.exportActionItems(note.actionItems, noteTitle: note.title)
    }

    public func exportToCalendar(startDate: Date = Date().addingTimeInterval(3600)) async throws {
        try await CalendarExportService.shared.exportEvent(for: note, startDate: startDate)
    }

    public var markdownShareFileURL: URL? {
        NoteExportService.shared.exportTemporaryMarkdownFile(for: note)
    }

    public var pdfShareFileURL: URL? {
        PDFExportService.shared.exportTemporaryPDF(for: note)
    }

    public func isActionItemCompleted(_ item: String) -> Bool {
        note.completedActionItems.contains(item)
    }

    public func toggleActionItem(_ item: String) {
        var updated = note
        if let idx = updated.completedActionItems.firstIndex(of: item) {
            updated.completedActionItems.remove(at: idx)
            // If markdown has - [x] item, revert to - [ ] item
            updated.cleanedNote = updated.cleanedNote.replacingOccurrences(of: "- [x] \(item)", with: "- [ ] \(item)")
        } else {
            updated.completedActionItems.append(item)
            // If markdown has - [ ] item, mark as - [x] item
            updated.cleanedNote = updated.cleanedNote.replacingOccurrences(of: "- [ ] \(item)", with: "- [x] \(item)")
        }
        self.note = updated
        repository.save(updated)
    }
    
    /// Triggers Stage 2's "light" rewrite the first time something actually needs to display it
    /// (see `NoteDetailView`'s light cleanup tab) -- a no-op if it's off in Settings, already
    /// generated, not yet generatable (note isn't `.ready`), or already in flight.
    public func ensureLightCleanupGenerated() {
        guard NoteProcessingPipeline.isLightCleanupEnabled,
              note.status == .ready,
              note.lightCleanedNote == nil,
              !isGeneratingLightCleanup else { return }
        isGeneratingLightCleanup = true
        Task {
            await pipeline.generateLightCleanup(noteId: note.id)
            isGeneratingLightCleanup = false
        }
    }

    public func reprocessNote() {
        isReprocessing = true
        Task {
            await pipeline.reprocessWithLLM(noteId: note.id)
            isReprocessing = false
        }
    }

    /// Re-runs the full ASR + LLM pipeline from the original audio, for notes that failed
    /// before a transcript was ever produced (`reprocessNote()` only re-runs Stage 2, which
    /// needs an existing transcript and is a no-op otherwise).
    public func retryFullProcessing() {
        isReprocessing = true
        Task {
            await pipeline.process(note: note)
            isReprocessing = false
        }
    }
    
    public func toggleFavorite() {
        repository.toggleFavorite(id: note.id)
    }

    public func beginEditing() {
        editedTitle = note.title
        editedCleanedNote = note.cleanedNote
        isEditing = true
    }

    public func saveEdits() {
        var updated = note
        let trimmedTitle = editedTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.title = trimmedTitle.isEmpty ? note.title : trimmedTitle
        updated.cleanedNote = editedCleanedNote

        // Re-synchronize templateSections and legacy fields from the edited markdown so
        // the structured info cards above stay in lockstep with the markdown text below.
        let parsedSections = Self.parseSectionsFromMarkdown(editedCleanedNote, originalSections: note.effectiveTemplateSections)
        if !parsedSections.isEmpty {
            updated.templateSections = parsedSections
            let (reqs, conds, actions) = LLMCopywriterService.legacyFields(from: parsedSections)
            let resolvedReqs = !reqs.isEmpty ? reqs : (parsedSections.first(where: { $0.title.localizedCaseInsensitiveContains("requirement") })?.items ?? [])
            let resolvedConds = !conds.isEmpty ? conds : (parsedSections.first(where: { $0.title.localizedCaseInsensitiveContains("condition") })?.items ?? [])
            let resolvedActions = !actions.isEmpty ? actions : (parsedSections.first(where: { $0.title.localizedCaseInsensitiveContains("action") || $0.style == .checklist })?.items ?? [])

            if !resolvedReqs.isEmpty { updated.requirements = resolvedReqs }
            if !resolvedConds.isEmpty { updated.conditions = resolvedConds }
            if !resolvedActions.isEmpty { updated.actionItems = resolvedActions }
        }

        repository.save(updated)
        isEditing = false
    }

    /// Parses markdown with `### Header` headers into structured `TemplateSectionContent` items,
    /// matching against original sections' styles when possible.
    public static func parseSectionsFromMarkdown(_ markdown: String, originalSections: [TemplateSectionContent]) -> [TemplateSectionContent] {
        let lines = markdown.components(separatedBy: .newlines)
        var sections: [TemplateSectionContent] = []
        var currentTitle: String? = nil
        var currentItems: [String] = []
        var hasChecklistItems = false
        var hasNumberedItems = false

        func flushSection() {
            guard let title = currentTitle, !currentItems.isEmpty else { return }
            var style = originalSections.first(where: { $0.title == title })?.style
            if style == nil {
                if hasChecklistItems {
                    style = .checklist
                } else if hasNumberedItems {
                    style = .numbered
                } else {
                    style = .bullet
                }
            }
            sections.append(TemplateSectionContent(title: title, style: style ?? .bullet, items: currentItems))
            currentItems.removeAll()
            hasChecklistItems = false
            hasNumberedItems = false
        }

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("### ") {
                flushSection()
                currentTitle = String(trimmed.dropFirst(4)).trimmingCharacters(in: .whitespaces)
            } else if trimmed.hasPrefix("- [ ] ") || trimmed.hasPrefix("- [x] ") {
                hasChecklistItems = true
                currentItems.append(String(trimmed.dropFirst(6)).trimmingCharacters(in: .whitespaces))
            } else if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
                currentItems.append(String(trimmed.dropFirst(2)).trimmingCharacters(in: .whitespaces))
            } else if let dotIndex = trimmed.firstIndex(of: "."),
                      dotIndex > trimmed.startIndex,
                      Int(trimmed[..<dotIndex]) != nil {
                hasNumberedItems = true
                let afterDot = trimmed[trimmed.index(after: dotIndex)...].trimmingCharacters(in: .whitespaces)
                if !afterDot.isEmpty {
                    currentItems.append(afterDot)
                }
            } else if !trimmed.isEmpty && !trimmed.hasPrefix("#") && !trimmed.hasPrefix(">") {
                if currentTitle != nil {
                    currentItems.append(trimmed)
                }
            }
        }
        flushSection()
        return sections
    }

    public func cancelEditing() {
        isEditing = false
    }
}
