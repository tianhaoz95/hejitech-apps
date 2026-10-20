import Foundation

/// Represents the origin of a voice note capture
public enum NoteSource: String, Codable, CaseIterable, Sendable {
    case watchComplication = "watch_complication"
    case watchLiveActivity = "watch_live_activity"
    case watchApp = "watch_app"
    case phoneApp = "phone_app"
    case macApp = "mac_app"
    /// A file shared or imported into Voxbrief (share sheet, Files), not recorded by it.
    case imported = "imported"

    /// Unknown raw values (a source added by a newer build) decode as `.phoneApp` instead of
    /// failing the whole note -- and with it, `NoteRepository`'s whole store.
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = NoteSource(rawValue: raw) ?? .phoneApp
    }

    public var displayName: String {
        switch self {
        case .watchComplication: return "Watch Complication"
        case .watchLiveActivity: return "Watch Live Activity"
        case .watchApp: return "Apple Watch"
        case .phoneApp: return "iPhone"
        case .macApp: return "Mac"
        case .imported: return "Imported"
        }
    }

    public var iconName: String {
        switch self {
        case .watchComplication: return "applewatch.radiowaves.left.and.right"
        case .watchLiveActivity: return "waveform.badge.magnifyingglass"
        case .watchApp: return "applewatch"
        case .phoneApp: return "iphone"
        case .macApp: return "macbook"
        case .imported: return "square.and.arrow.down"
        }
    }
}

/// Pipeline processing status of a voice note
public enum NoteProcessingStatus: String, Codable, Sendable, CaseIterable {
    case recordedOnWatch = "recorded_on_watch"
    case syncing = "syncing"
    case transcribingASR = "transcribing_asr"
    case cleaningLLM = "cleaning_llm"
    case ready = "ready"
    case failed = "failed"
    
    public var stepDescription: String {
        switch self {
        case .recordedOnWatch: return "Saved on Watch"
        case .syncing: return "Syncing to iPhone..."
        case .transcribingASR: return "Stage 1: Speech-to-Text (ASR)..."
        case .cleaningLLM: return "Stage 2: LLM Copywriting & Structure..."
        case .ready: return "Processed & Ready"
        case .failed: return "Processing Failed"
        }
    }
    
    public var isProcessing: Bool {
        switch self {
        case .syncing, .transcribingASR, .cleaningLLM:
            return true
        case .recordedOnWatch, .ready, .failed:
            return false
        }
    }

    /// SF Symbol representing this stage, for live-progress UI (e.g. the reprocessing indicator
    /// in `NoteDetailView`).
    public var iconName: String {
        switch self {
        case .recordedOnWatch: return "applewatch"
        case .syncing: return "arrow.triangle.2.circlepath"
        case .transcribingASR: return "waveform"
        case .cleaningLLM: return "sparkles"
        case .ready: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }
}

/// One recording session folded into a `VoiceNote`. A note always has at least one segment once
/// Stage 1 (ASR) has produced a transcript for it; a plain single-recording note simply has one.
/// Appending a further recording (see `NoteProcessingPipeline.appendRecording`/`mergeNote`) adds
/// another segment and re-runs Stage 2 over all of them together, so the LLM always sees the
/// note's full history rather than just the newest snippet.
public struct NoteSegment: Codable, Hashable, Sendable, Identifiable {
    public let id: UUID
    public let audioFileName: String
    public let createdAt: Date
    public let duration: TimeInterval
    public let source: NoteSource
    public var rawTranscript: String

    public init(id: UUID, audioFileName: String, createdAt: Date, duration: TimeInterval, source: NoteSource, rawTranscript: String) {
        self.id = id
        self.audioFileName = audioFileName
        self.createdAt = createdAt
        self.duration = duration
        self.source = source
        self.rawTranscript = rawTranscript
    }
}

/// Time-aligned audio transcript segment for interactive scrubbing and playback sync.
public struct TranscriptTimingSegment: Codable, Hashable, Sendable, Identifiable {
    public let id: UUID
    public let start: TimeInterval
    public let end: TimeInterval
    public let text: String

    public init(id: UUID = UUID(), start: TimeInterval, end: TimeInterval, text: String) {
        self.id = id
        self.start = start
        self.end = end
        self.text = text
    }

    public var formattedRange: String {
        "\(start.formattedDuration) - \(end.formattedDuration)"
    }

    /// One piece of a segment's text: either spoken words, or a Whisper control token
    /// (`<|startoftranscript|>`, `<|en|>`, `<|7.54|>`, ...) that WhisperKit leaves inline.
    public enum TextPart: Hashable, Sendable {
        case text(String)
        case token(SpecialToken)
    }

    public enum SpecialToken: Hashable, Sendable {
        case timestamp(TimeInterval)
        case startOfTranscript
        case endOfText
        case language(String)
        case task(String)
        case noTimestamps
        case other(String)

        init(rawName: String) {
            let name = rawName.trimmingCharacters(in: .whitespaces)
            if let seconds = TimeInterval(name) {
                self = .timestamp(seconds)
                return
            }
            switch name.lowercased() {
            case "startoftranscript": self = .startOfTranscript
            case "endoftext": self = .endOfText
            case "notimestamps": self = .noTimestamps
            case "transcribe", "translate": self = .task(name.lowercased())
            default:
                let isLanguageCode = (2...3).contains(name.count) && name.allSatisfy { $0.isLetter && $0.isLowercase }
                self = isLanguageCode ? .language(name) : .other(name)
            }
        }
    }

    /// `text` split into spoken words and Whisper control tokens, in order. Whitespace-only
    /// runs between tokens are dropped.
    public var parts: [TextPart] {
        var result: [TextPart] = []
        var remaining = Substring(text)
        while let open = remaining.range(of: "<|") {
            guard let close = remaining[open.upperBound...].range(of: "|>") else { break }
            let before = remaining[..<open.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
            if !before.isEmpty { result.append(.text(before)) }
            result.append(.token(SpecialToken(rawName: String(remaining[open.upperBound..<close.lowerBound]))))
            remaining = remaining[close.upperBound...]
        }
        let tail = remaining.trimmingCharacters(in: .whitespacesAndNewlines)
        if !tail.isEmpty { result.append(.text(tail)) }
        return result
    }

    /// The spoken words only, with every Whisper control token removed.
    public var displayText: String {
        parts.compactMap { part -> String? in
            if case .text(let words) = part { return words }
            return nil
        }
        .joined(separator: " ")
    }
}

/// One part of a long memo that Stage 2 read in several passes (see
/// `LLMCopywriterService.longTranscriptWordThreshold`): where the part starts, as a fraction of
/// the transcript's words (times are derived from the note's duration, so they stay valid
/// without word-level timings), and the one-sentence summary Stage 2 wrote for that part.
public struct LongMemoPart: Codable, Hashable, Sendable {
    public let startFraction: Double
    public let summary: String

    public init(startFraction: Double, summary: String) {
        self.startFraction = startFraction
        self.summary = summary
    }
}

/// How long one pipeline step took on the device, for the Pipeline tab and for measuring Stage 2
/// changes ("Transcribe", "Pick template", "Write note", "Part 2 of 3", "Overview").
public struct ProcessingTiming: Codable, Hashable, Sendable {
    public let name: String
    public let seconds: Double

    public init(name: String, seconds: Double) {
        self.name = name
        self.seconds = seconds
    }
}

/// Complete Voice Note model containing raw audio metadata, ASR transcript, and LLM-processed note
public struct VoiceNote: Identifiable, Codable, Hashable, Sendable {
    public let id: UUID
    public var createdAt: Date
    public var duration: TimeInterval
    public var audioFileName: String?

    /// Ordered oldest -> newest. Populated once Stage 1 produces this note's first transcript;
    /// empty for a note still mid-sync/ASR, and for notes persisted before this field existed --
    /// `init(from:)` below decodes it with `decodeIfPresent(...) ?? []` specifically so old
    /// `notes_store.json` files missing this key still decode instead of failing outright (a
    /// synthesized `Decodable` would require the key to be present for a non-Optional property,
    /// inline default or not). See `NoteProcessingPipeline`'s `legacySegment(from:)` for how call
    /// sites reconstruct a single segment from the top-level fields when this is empty.
    public var segments: [NoteSegment] = []

    // Extracted and generated content
    public var title: String
    public var summary: String
    public var rawTranscript: String
    public var cleanedNote: String
    
    // Structured extractions from LLM stage
    public var requirements: [String]
    public var conditions: [String]
    public var actionItems: [String]
    public var completedActionItems: [String] = []
    public var actionItemPriorities: [String: String] = [:]
    public var tags: [String]
    
    // Metadata & Pipeline Status
    public var status: NoteProcessingStatus
    public var source: NoteSource
    public var isFavorite: Bool
    public var isPinned: Bool = false
    public var isArchived: Bool = false
    public var colorTag: String?
    public var isLocked: Bool = false
    public var errorMessage: String?

    /// Human-readable label for whichever Stage 2 engine actually produced this note's cleanup
    /// (e.g. "On-Device LLM (Qwen3-0.6B)", "Ollama", or the rule-based fallback's label) --
    /// `nil` for notes processed before this field existed. Lets the UI show the user when the
    /// preferred engine wasn't available instead of silently degrading to the rule-based
    /// transformer with no indication anything less than the real LLM ran.
    public var cleanupEngine: String?

    /// Stage 2's "light" rewrite: typos/grammar/filler words fixed, but original wording and
    /// sentence order preserved -- no requirements/conditions/action-item restructuring. Kept
    /// alongside `cleanedNote` (the structured "full" rewrite) so the UI can offer both. `nil`
    /// for notes processed before this field existed, or if the light pass failed.
    public var lightCleanedNote: String?
    public var lightCleanupEngine: String?

    /// General-purpose structured content for whichever `NoteTemplate` Stage 2 chose (see
    /// `LLMCopywriterService`'s classify-then-generate flow) -- generalizes what `requirements`/
    /// `conditions`/`actionItems` used to be the only possible shape of. Empty for notes
    /// processed before this field existed; `NoteDetailView` uses `effectiveTemplateSections`
    /// below to synthesize an equivalent value from the legacy arrays for those.
    public var templateSections: [TemplateSectionContent] = []
    /// Which `NoteTemplate` produced `templateSections`, by ID -- `nil` for notes with no
    /// template concept (the light rewrite, or ones processed before this existed). Kept even
    /// though `templateName` is also stored so a future feature could look up the live template
    /// (e.g. to re-run Stage 2 with it) without string-matching on a display name that could
    /// have been renamed since.
    public var templateId: UUID?
    /// Display-name snapshot of the template at generation time, so a note keeps showing what
    /// was actually used even if that template is later renamed or deleted.
    public var templateName: String?

    /// Time-indexed segments produced during speech-to-text, enabling interactive audio-transcript sync.
    public var transcriptSegments: [TranscriptTimingSegment] = []

    /// Parts of a long memo that Stage 2 summarised separately and merged. Empty for a memo short
    /// enough to read in one pass, and for notes processed before this field existed.
    public var longMemoParts: [LongMemoPart] = []

    /// Step timings of the last pipeline run, in order. Empty for notes processed before this
    /// field existed.
    public var processingTimings: [ProcessingTiming] = []

    public init(
        id: UUID = UUID(),
        createdAt: Date = Date(),
        duration: TimeInterval = 0,
        audioFileName: String? = nil,
        segments: [NoteSegment] = [],
        title: String = "Untitled Note",
        summary: String = "",
        rawTranscript: String = "",
        cleanedNote: String = "",
        requirements: [String] = [],
        conditions: [String] = [],
        actionItems: [String] = [],
        completedActionItems: [String] = [],
        actionItemPriorities: [String: String] = [:],
        tags: [String] = [],
        status: NoteProcessingStatus = .ready,
        source: NoteSource = .phoneApp,
        isFavorite: Bool = false,
        isPinned: Bool = false,
        isArchived: Bool = false,
        colorTag: String? = nil,
        isLocked: Bool = false,
        errorMessage: String? = nil,
        cleanupEngine: String? = nil,
        lightCleanedNote: String? = nil,
        lightCleanupEngine: String? = nil,
        templateSections: [TemplateSectionContent] = [],
        templateId: UUID? = nil,
        templateName: String? = nil,
        transcriptSegments: [TranscriptTimingSegment] = [],
        longMemoParts: [LongMemoPart] = []
    ) {
        self.id = id
        self.createdAt = createdAt
        self.duration = duration
        self.audioFileName = audioFileName
        self.segments = segments
        self.title = title
        self.summary = summary
        self.rawTranscript = rawTranscript
        self.cleanedNote = cleanedNote
        self.requirements = requirements
        self.conditions = conditions
        self.actionItems = actionItems
        self.completedActionItems = completedActionItems
        self.actionItemPriorities = actionItemPriorities
        self.tags = tags
        self.status = status
        self.source = source
        self.isFavorite = isFavorite
        self.isPinned = isPinned
        self.isArchived = isArchived
        self.colorTag = colorTag
        self.isLocked = isLocked
        self.errorMessage = errorMessage
        self.cleanupEngine = cleanupEngine
        self.lightCleanedNote = lightCleanedNote
        self.lightCleanupEngine = lightCleanupEngine
        self.templateSections = templateSections
        self.templateId = templateId
        self.templateName = templateName
        self.transcriptSegments = transcriptSegments
        self.longMemoParts = longMemoParts
    }

    /// Hand-written (rather than relying on synthesized `Decodable`) solely so `segments` can use
    /// `decodeIfPresent(...) ?? []` -- every other field decodes exactly as synthesis would.
    /// `Encodable`'s `encode(to:)` is still compiler-synthesized as usual.
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        duration = try container.decode(TimeInterval.self, forKey: .duration)
        audioFileName = try container.decodeIfPresent(String.self, forKey: .audioFileName)
        segments = try container.decodeIfPresent([NoteSegment].self, forKey: .segments) ?? []
        title = try container.decode(String.self, forKey: .title)
        summary = try container.decode(String.self, forKey: .summary)
        rawTranscript = try container.decode(String.self, forKey: .rawTranscript)
        cleanedNote = try container.decode(String.self, forKey: .cleanedNote)
        requirements = try container.decode([String].self, forKey: .requirements)
        conditions = try container.decode([String].self, forKey: .conditions)
        actionItems = try container.decode([String].self, forKey: .actionItems)
        completedActionItems = try container.decodeIfPresent([String].self, forKey: .completedActionItems) ?? []
        actionItemPriorities = try container.decodeIfPresent([String: String].self, forKey: .actionItemPriorities) ?? [:]
        tags = try container.decode([String].self, forKey: .tags)
        status = try container.decode(NoteProcessingStatus.self, forKey: .status)
        source = try container.decode(NoteSource.self, forKey: .source)
        isFavorite = try container.decode(Bool.self, forKey: .isFavorite)
        isPinned = try container.decodeIfPresent(Bool.self, forKey: .isPinned) ?? false
        isArchived = try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
        colorTag = try container.decodeIfPresent(String.self, forKey: .colorTag)
        isLocked = try container.decodeIfPresent(Bool.self, forKey: .isLocked) ?? false
        errorMessage = try container.decodeIfPresent(String.self, forKey: .errorMessage)
        cleanupEngine = try container.decodeIfPresent(String.self, forKey: .cleanupEngine)
        lightCleanedNote = try container.decodeIfPresent(String.self, forKey: .lightCleanedNote)
        lightCleanupEngine = try container.decodeIfPresent(String.self, forKey: .lightCleanupEngine)
        templateSections = try container.decodeIfPresent([TemplateSectionContent].self, forKey: .templateSections) ?? []
        templateId = try container.decodeIfPresent(UUID.self, forKey: .templateId)
        templateName = try container.decodeIfPresent(String.self, forKey: .templateName)
        transcriptSegments = try container.decodeIfPresent([TranscriptTimingSegment].self, forKey: .transcriptSegments) ?? []
        longMemoParts = try container.decodeIfPresent([LongMemoPart].self, forKey: .longMemoParts) ?? []
        processingTimings = try container.decodeIfPresent([ProcessingTiming].self, forKey: .processingTimings) ?? []
    }

    /// `templateSections` if this note has any (every note processed after multi-template
    /// support shipped), otherwise a synthesized equivalent built from the legacy `requirements`/
    /// `conditions`/`actionItems` arrays -- gives `NoteDetailView` exactly one rendering path
    /// for both old and new notes instead of two branches to keep in sync. Not stored: this is
    /// recomputed on read, never persisted, so it always reflects the real underlying fields.
    public var effectiveTemplateSections: [TemplateSectionContent] {
        guard templateSections.isEmpty else { return templateSections }
        var synthesized: [TemplateSectionContent] = []
        if !requirements.isEmpty {
            synthesized.append(TemplateSectionContent(title: "🎯 Requirements", style: .bullet, items: requirements))
        }
        if !conditions.isEmpty {
            synthesized.append(TemplateSectionContent(title: "🔢 Enumerated Conditions & Workflow", style: .numbered, items: conditions))
        }
        if !actionItems.isEmpty {
            synthesized.append(TemplateSectionContent(title: "✅ Action Items", style: .checklist, items: actionItems))
        }
        return synthesized
    }

    /// Word count calculated from whichever text is the primary output: cleanedNote or rawTranscript.
    public var wordCount: Int {
        let text = cleanedNote.isEmpty ? rawTranscript : cleanedNote
        let words = text.components(separatedBy: CharacterSet.whitespacesAndNewlines)
            .filter { !$0.trimmingCharacters(in: .punctuationCharacters).isEmpty }
        return words.count
    }

    /// Estimated reading time in minutes (based on standard reading speed of 200 words per minute).
    public var readingTimeMinutes: Double {
        let words = Double(wordCount)
        return max(0.1, (words / 200.0 * 10).rounded() / 10)
    }

    /// Human-friendly formatted reading time (e.g. "< 1 min read", "2 min read").
    public var formattedReadingTime: String {
        let minutes = Int(ceil(Double(wordCount) / 200.0))
        if minutes <= 1 {
            return "< 1 min read"
        } else {
            return "\(minutes) min read"
        }
    }

    /// Returns completed count, total count, and ratio (0.0 to 1.0) for action items.
    public var actionItemsProgress: (completed: Int, total: Int, ratio: Double) {
        let total = actionItems.count
        guard total > 0 else { return (0, 0, 0.0) }
        let completed = completedActionItems.filter { actionItems.contains($0) }.count
        return (completed, total, Double(completed) / Double(total))
    }

    /// Priority level for a specific action item ("high", "medium", "low", or nil).
    public func priority(for actionItem: String) -> String? {
        actionItemPriorities[actionItem]
    }

    /// Estimated speaking speed in words per minute (WPM).
    public var spokenWPM: Int {
        guard duration > 3 else { return 0 }
        let words = wordCount
        let minutes = duration / 60.0
        return Int((Double(words) / minutes).rounded())
    }

    /// Speaking tempo classification based on spoken WPM.
    public var speechCadenceLabel: String {
        let wpm = spokenWPM
        guard wpm > 0 else { return "N/A" }
        if wpm < 115 {
            return "Deliberate"
        } else if wpm <= 165 {
            return "Conversational"
        } else {
            return "Rapid"
        }
    }
}
