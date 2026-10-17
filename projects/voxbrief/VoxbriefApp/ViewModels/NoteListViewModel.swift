import Foundation
import Combine

public enum SearchScope: String, CaseIterable, Identifiable, Sendable {
    case all = "All"
    case title = "Title"
    case content = "Content"
    case tags = "Tags"
    case actionItems = "Action Items"

    public var id: String { rawValue }
}

public enum SortOption: String, CaseIterable, Identifiable, Sendable {
    case newest = "Newest First"
    case oldest = "Oldest First"
    case titleAsc = "Title (A–Z)"
    case titleDesc = "Title (Z–A)"
    case durationLongest = "Longest Audio"
    case durationShortest = "Shortest Audio"

    public var id: String { rawValue }
}

@MainActor
public final class NoteListViewModel: ObservableObject {
    @Published public var searchText: String = ""
    @Published public var searchScope: SearchScope = .all
    @Published public var sortOption: SortOption = .newest
    @Published public var selectedTag: String? = nil
    @Published public var selectedColorTag: String? = nil
    @Published public var filterSource: NoteSource? = nil
    @Published public var onlyFavorites: Bool = false
    @Published public var showArchived: Bool = false
    @Published public var showingRecordSheet: Bool = false
    @Published public var showingSyncStatus: Bool = false
    @Published public var showingSettings: Bool = false

    /// Non-nil while the "Append To…" picker is up for this note; drives `.sheet(item:)`.
    @Published public var mergeSourceNote: VoiceNote? = nil
    
    private let repository: NoteRepository
    public let pipeline: NoteProcessingPipeline

    private var cancellables = Set<AnyCancellable>()

    public init(
        repository: NoteRepository = .shared,
        pipeline: NoteProcessingPipeline = .shared
    ) {
        self.repository = repository
        self.pipeline = pipeline
        
        // Forward changes from repository
        repository.objectWillChange
            .sink { [weak self] in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }
    
    public var notes: [VoiceNote] {
        let filtered = repository.notes.filter { note in
            // Archive filter
            if showArchived {
                guard note.isArchived else { return false }
            } else {
                guard !note.isArchived else { return false }
            }

            // Search filter with scope support
            if !searchText.isEmpty {
                let query = searchText.lowercased()
                switch searchScope {
                case .all:
                    let matchesTitle = note.title.lowercased().contains(query)
                    let matchesSummary = note.summary.lowercased().contains(query)
                    let matchesTranscript = note.rawTranscript.lowercased().contains(query)
                    let matchesCleaned = note.cleanedNote.lowercased().contains(query)
                    let matchesTags = note.tags.contains { $0.lowercased().contains(query) }
                    let matchesRequirements = note.requirements.contains { $0.lowercased().contains(query) }
                    let matchesConditions = note.conditions.contains { $0.lowercased().contains(query) }
                    let matchesActionItems = note.actionItems.contains { $0.lowercased().contains(query) }
                    let matchesTemplateSections = note.templateSections.flatMap(\.items).contains { $0.lowercased().contains(query) }
                    let matchesAny = matchesTitle || matchesSummary || matchesTranscript || matchesCleaned
                        || matchesTags || matchesRequirements || matchesConditions || matchesActionItems
                        || matchesTemplateSections
                    if !matchesAny { return false }
                case .title:
                    if !note.title.lowercased().contains(query) { return false }
                case .content:
                    let matchesSummary = note.summary.lowercased().contains(query)
                    let matchesTranscript = note.rawTranscript.lowercased().contains(query)
                    let matchesCleaned = note.cleanedNote.lowercased().contains(query)
                    if !(matchesSummary || matchesTranscript || matchesCleaned) { return false }
                case .tags:
                    let matchesTags = note.tags.contains { $0.lowercased().contains(query) }
                    if !matchesTags { return false }
                case .actionItems:
                    let matchesActions = note.actionItems.contains { $0.lowercased().contains(query) }
                    if !matchesActions { return false }
                }
            }
            
            // Tag filter
            if let selectedTag = selectedTag, !selectedTag.isEmpty {
                if !note.tags.contains(selectedTag) {
                    return false
                }
            }

            // Color tag filter
            if let selectedColorTag = selectedColorTag, !selectedColorTag.isEmpty {
                if note.colorTag != selectedColorTag {
                    return false
                }
            }
            
            // Source filter
            if let filterSource = filterSource {
                if note.source != filterSource {
                    return false
                }
            }
            
            // Favorites filter
            if onlyFavorites && !note.isFavorite {
                return false
            }
            
            return true
        }

        // Apply sorting
        return filtered.sorted { a, b in
            switch sortOption {
            case .newest:
                return a.createdAt > b.createdAt
            case .oldest:
                return a.createdAt < b.createdAt
            case .titleAsc:
                return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
            case .titleDesc:
                return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedDescending
            case .durationLongest:
                return a.duration > b.duration
            case .durationShortest:
                return a.duration < b.duration
            }
        }
    }

    /// Pinned notes subset of current filtered notes (only if not viewing archived)
    public var pinnedNotes: [VoiceNote] {
        guard !showArchived else { return [] }
        return notes.filter(\.isPinned)
    }

    /// Non-pinned notes subset of current filtered notes
    public var unpinnedNotes: [VoiceNote] {
        if showArchived {
            return notes
        }
        return notes.filter { !$0.isPinned }
    }
    
    public var allTags: [String] {
        var tagsSet = Set<String>()
        for note in repository.notes {
            for tag in note.tags {
                tagsSet.insert(tag)
            }
        }
        return Array(tagsSet).sorted()
    }

    public var tagCounts: [(tag: String, count: Int)] {
        var counts: [String: Int] = [:]
        for note in repository.notes where !note.isArchived {
            for tag in note.tags {
                counts[tag, default: 0] += 1
            }
        }
        return counts.map { (tag: $0.key, count: $0.value) }.sorted { $0.count > $1.count }
    }
    
    public func delete(note: VoiceNote) {
        repository.delete(id: note.id)
    }
    
    public func toggleFavorite(note: VoiceNote) {
        repository.toggleFavorite(id: note.id)
    }

    public func togglePinned(note: VoiceNote) {
        repository.togglePinned(id: note.id)
    }

    public func toggleArchived(note: VoiceNote) {
        repository.toggleArchived(id: note.id)
    }

    @discardableResult
    public func duplicate(note: VoiceNote) -> VoiceNote? {
        repository.duplicate(id: note.id)
    }
    
    /// Re-runs only Stage 2 when the note already has a transcript (its AI step failed),
    /// otherwise the whole pipeline from the audio.
    public func retryProcessing(note: VoiceNote) {
        Task {
            if note.rawTranscript.isEmpty {
                await pipeline.process(note: note)
            } else {
                await pipeline.reprocessWithLLM(noteId: note.id)
            }
        }
    }

    public func beginMerge(source: VoiceNote) {
        mergeSourceNote = source
    }

    public func mergeCandidates(excluding source: VoiceNote) -> [VoiceNote] {
        repository.notes.filter { $0.id != source.id && $0.status == .ready }
    }

    public func confirmMerge(source: VoiceNote, into target: VoiceNote) {
        Task {
            await pipeline.mergeNote(sourceId: source.id, intoTargetId: target.id)
        }
        mergeSourceNote = nil
    }

    public func refresh() async {
        for note in repository.notes where note.status.isProcessing {
            await pipeline.process(note: note)
        }
    }

    public func exportAllNotesMarkdown() -> String {
        guard !repository.notes.isEmpty else {
            return "_No voice notes captured yet._"
        }
        return repository.notes
            .sorted(by: { $0.createdAt > $1.createdAt })
            .map { note in
                note.cleanedNote.isEmpty ? "# \(note.title)\n\n\(note.rawTranscript)" : note.cleanedNote
            }
            .joined(separator: "\n\n---\n\n")
    }

    // MARK: - Batch Multi-Select Operations

    public func bulkDelete(ids: Set<UUID>) {
        repository.bulkDelete(ids: ids)
    }

    public func bulkArchive(ids: Set<UUID>, archive: Bool = true) {
        repository.bulkArchive(ids: ids, archive: archive)
    }

    public func bulkArchive(ids: Set<UUID>, isArchived: Bool) {
        repository.bulkArchive(ids: ids, archive: isArchived)
    }

    public func bulkFavorite(ids: Set<UUID>, isFavorite: Bool = true) {
        repository.bulkSetFavorite(ids: ids, isFavorite: isFavorite)
    }

    public func bulkPin(ids: Set<UUID>, isPinned: Bool = true) {
        repository.bulkSetPinned(ids: ids, isPinned: isPinned)
    }

    public func bulkAddTag(ids: Set<UUID>, tag: String) {
        repository.bulkAddTag(ids: ids, tag: tag)
    }

    public func exportSelectedNotesMarkdown(ids: Set<UUID>) -> String {
        let selected = repository.notes.filter { ids.contains($0.id) }
        guard !selected.isEmpty else { return "_No notes selected._" }
        return selected
            .sorted(by: { $0.createdAt > $1.createdAt })
            .map { note in
                note.cleanedNote.isEmpty ? "# \(note.title)\n\n\(note.rawTranscript)" : note.cleanedNote
            }
            .joined(separator: "\n\n---\n\n")
    }

    public var presetColorTags: [PresetColorTag] {
        Self.presetColorTags
    }

    public static let presetColorTags: [PresetColorTag] = [
        PresetColorTag(name: "Red", id: "red", hex: "#FF3B30"),
        PresetColorTag(name: "Orange", id: "orange", hex: "#FF9500"),
        PresetColorTag(name: "Yellow", id: "yellow", hex: "#FFCC00"),
        PresetColorTag(name: "Green", id: "green", hex: "#34C759"),
        PresetColorTag(name: "Teal", id: "teal", hex: "#30B0C7"),
        PresetColorTag(name: "Blue", id: "blue", hex: "#007AFF"),
        PresetColorTag(name: "Indigo", id: "indigo", hex: "#5856D6"),
        PresetColorTag(name: "Purple", id: "purple", hex: "#AF52DE"),
        PresetColorTag(name: "Pink", id: "pink", hex: "#FF2D55")
    ]
}

public struct PresetColorTag: Identifiable, Hashable, Sendable {
    public let name: String
    public let id: String
    public let hex: String

    public init(name: String, id: String, hex: String) {
        self.name = name
        self.id = id
        self.hex = hex
    }
}

