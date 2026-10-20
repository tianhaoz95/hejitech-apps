import Foundation

/// A keyword (BM25) index over the user's notes, for Ask Voxbrief. Deliberately no embedding
/// model: Ask answers with the same on-device engine that writes the notes, and finds what to
/// show it with plain keyword ranking, so nothing new is bundled or downloaded.
///
/// Each note becomes several passages: its title + summary, one per structured section, and
/// ~60-word windows of its transcript (timed when Stage 1 produced timings, so an answer can
/// cite the moment it came from). Built in memory from a snapshot of the notes, which takes
/// milliseconds for hundreds of notes, so there is no index file to keep in sync or rebuild after
/// a restore.
struct NoteSearchIndex: Sendable {
    struct Passage: Sendable, Equatable {
        enum Kind: Sendable, Equatable {
            case overview
            case section(String)
            case transcript
        }

        let noteId: UUID
        let noteTitle: String
        let noteDate: Date
        let kind: Kind
        let text: String
        /// Where this passage starts in the note's audio, when known.
        let startTime: TimeInterval?
    }

    struct Hit: Sendable, Equatable {
        let passage: Passage
        let score: Double
    }

    static let transcriptWindowWords = 60

    let passages: [Passage]
    private let termFrequencies: [[String: Int]]
    private let lengths: [Int]
    private let documentFrequency: [String: Int]
    private let averageLength: Double

    init(notes: [VoiceNote]) {
        var passages: [Passage] = []
        // Locked notes stay out of Ask, like they stay out of the list's previews.
        for note in notes where !note.isLocked && (note.status == .ready || !note.rawTranscript.isEmpty) {
            passages.append(contentsOf: Self.makePassages(for: note))
        }
        self.passages = passages
        termFrequencies = passages.map { passage in
            Self.terms(in: passage.noteTitle + " " + passage.text).reduce(into: [:]) { $0[$1, default: 0] += 1 }
        }
        lengths = termFrequencies.map { $0.values.reduce(0, +) }
        var df: [String: Int] = [:]
        for frequencies in termFrequencies {
            for term in frequencies.keys { df[term, default: 0] += 1 }
        }
        documentFrequency = df
        averageLength = lengths.isEmpty ? 1 : Double(lengths.reduce(0, +)) / Double(lengths.count)
    }

    /// The best passages for `keywords`, at most `limit`, never more than `maxPerNote` from one
    /// note (so one long meeting can't crowd out everything else). Passages from notes newer than
    /// `since` get a boost, rather than a hard filter, because "last week" in a question is often
    /// approximate. Keywords may be phrases; they're split into words.
    func search(_ keywords: [String], since: Date? = nil, limit: Int = 6, maxPerNote: Int = 3) -> [Hit] {
        let queryTerms = Set(keywords.flatMap(Self.terms(in:)))
        guard !queryTerms.isEmpty, !passages.isEmpty else { return [] }
        let count = Double(passages.count)
        let k1 = 1.2, b = 0.75

        var hits: [Hit] = []
        for index in passages.indices {
            let frequencies = termFrequencies[index]
            var score = 0.0
            for term in queryTerms {
                guard let tf = frequencies[term].map(Double.init) else { continue }
                let df = Double(documentFrequency[term] ?? 0)
                let idf = log(1 + (count - df + 0.5) / (df + 0.5))
                let norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * Double(lengths[index]) / averageLength))
                score += idf * norm
            }
            guard score > 0 else { continue }
            if let since, passages[index].noteDate >= since { score *= 1.5 }
            if case .overview = passages[index].kind { score *= 1.1 }
            hits.append(Hit(passage: passages[index], score: score))
        }
        hits.sort { $0.score > $1.score }

        var perNote: [UUID: Int] = [:]
        var result: [Hit] = []
        for hit in hits {
            let used = perNote[hit.passage.noteId, default: 0]
            guard used < maxPerNote else { continue }
            perNote[hit.passage.noteId] = used + 1
            result.append(hit)
            if result.count == limit { break }
        }
        return result
    }

    // MARK: - Building passages

    static func makePassages(for note: VoiceNote) -> [Passage] {
        var result: [Passage] = []
        let overview = [note.title, note.summary, note.tags.joined(separator: " ")]
            .filter { !$0.isEmpty }
            .joined(separator: ". ")
        if !overview.isEmpty {
            result.append(Passage(noteId: note.id, noteTitle: note.title, noteDate: note.createdAt, kind: .overview, text: overview, startTime: nil))
        }
        for section in note.effectiveTemplateSections where !section.items.isEmpty {
            result.append(Passage(
                noteId: note.id, noteTitle: note.title, noteDate: note.createdAt,
                kind: .section(section.title), text: section.items.joined(separator: "; "), startTime: nil
            ))
        }
        result.append(contentsOf: transcriptWindows(for: note))
        return result
    }

    /// ~60-word windows of the transcript. With timing segments, windows follow them (so each has
    /// a start time); otherwise the plain transcript is cut by words.
    static func transcriptWindows(for note: VoiceNote) -> [Passage] {
        var windows: [Passage] = []
        let timed = note.segments.count <= 1 ? note.transcriptSegments : []
        if !timed.isEmpty {
            var words: [String] = []
            var start: TimeInterval?
            for segment in timed {
                let text = segment.displayText
                guard !text.isEmpty else { continue }
                if start == nil { start = segment.start }
                words.append(contentsOf: text.split(whereSeparator: \.isWhitespace).map(String.init))
                if words.count >= transcriptWindowWords {
                    windows.append(Passage(noteId: note.id, noteTitle: note.title, noteDate: note.createdAt, kind: .transcript, text: words.joined(separator: " "), startTime: start))
                    words = []
                    start = nil
                }
            }
            if !words.isEmpty {
                windows.append(Passage(noteId: note.id, noteTitle: note.title, noteDate: note.createdAt, kind: .transcript, text: words.joined(separator: " "), startTime: start))
            }
            return windows
        }
        let words = note.rawTranscript.split(whereSeparator: \.isWhitespace)
        stride(from: 0, to: words.count, by: transcriptWindowWords).forEach { start in
            let text = words[start..<min(start + transcriptWindowWords, words.count)].joined(separator: " ")
            windows.append(Passage(noteId: note.id, noteTitle: note.title, noteDate: note.createdAt, kind: .transcript, text: text, startTime: nil))
        }
        return windows
    }

    // MARK: - Terms

    /// Lowercased words, without stop words, with a light plural/-ing/-ed stem so "contractors"
    /// finds "contractor" and "meeting" finds "meet". `internal` for tests.
    static func terms(in text: String) -> [String] {
        text.lowercased()
            .split { !$0.isLetter && !$0.isNumber }
            .map(String.init)
            .filter { $0.count > 1 && !stopWords.contains($0) }
            .map(stem)
    }

    static func stem(_ word: String) -> String {
        guard word.count > 4 else { return word }
        for suffix in ["ing", "ies", "ed", "es", "s"] where word.hasSuffix(suffix) {
            let base = String(word.dropLast(suffix.count))
            guard base.count >= 3 else { continue }
            return suffix == "ies" ? base + "y" : base
        }
        return word
    }

    static let stopWords: Set<String> = [
        "a", "an", "and", "are", "as", "at", "be", "but", "by", "did", "do", "does", "for", "from",
        "had", "has", "have", "he", "her", "him", "his", "how", "i", "if", "in", "into", "is", "it",
        "its", "me", "my", "of", "on", "or", "our", "she", "so", "that", "the", "their", "them",
        "then", "there", "these", "they", "this", "to", "um", "uh", "was", "we", "were", "what",
        "when", "where", "which", "who", "why", "will", "with", "would", "you", "your", "about",
        "all", "any", "can", "could", "just", "like", "should", "some", "than", "too", "very",
        "know", "yeah", "okay", "ok", "gonna", "need", "want", "get", "got", "say", "said", "tell",
        "told", "note", "notes", "memo", "memos",
    ]
}
