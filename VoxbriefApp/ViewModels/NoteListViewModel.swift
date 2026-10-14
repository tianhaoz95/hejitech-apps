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
    
    public func retryProcessing(note: VoiceNote) {
        Task {
            await pipeline.process(note: note)
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
}
