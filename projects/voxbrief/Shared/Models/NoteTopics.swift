import Foundation

/// One topic of a long recording (an all-day watch recording, say): the stretch of it about one
/// subject, its own title and one-line summary, and its cleaned text. Times are seconds from the
/// start of the note's audio.
public struct NoteTopic: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var start: TimeInterval
    public var end: TimeInterval
    public var title: String
    public var summary: String
    public var text: String

    public init(id: UUID = UUID(), start: TimeInterval, end: TimeInterval, title: String, summary: String, text: String) {
        self.id = id
        self.start = start
        self.end = end
        self.title = title
        self.summary = summary
        self.text = text
    }
}

/// Splitting a long recording where its subject changes, with no model: TextTiling (Hearst,
/// 1997) over the timed transcript, plus long silences, which over a day of recording are the
/// clearest breaks there are. The model then cleans up and titles each topic on its own.
public enum NoteTopics {
    /// Only recordings at least this long are split: an all-day recording has many subjects,
    /// while a memo or a meeting is one note about one thing.
    public static let minimumDuration: TimeInterval = 3600
    /// Words per block, the unit the transcript's vocabulary is compared in.
    static let blockWords = 120
    /// Blocks on each side of a gap that are compared.
    static let window = 4
    /// Nothing said for this long ends a topic.
    static let silenceGap: TimeInterval = 300
    /// A topic found from the words alone has at least this many words (about 5 minutes of talk).
    static let minimumTopicWords = 600
    /// A stretch of talk between silences is a topic of its own from this many words; a shorter
    /// one goes with its neighbour.
    static let minimumWordsBetweenSilences = 80
    /// At most this many topics a recording.
    static let maximumTopics = 16

    /// One topic's place in the transcript: its timing segments, and when it starts and ends.
    public struct Span: Equatable, Sendable {
        public let segments: Range<Int>
        public let start: TimeInterval
        public let end: TimeInterval
        public let words: Int
    }

    /// The topics of `segments`, in order, covering every segment; nil when it is one topic.
    public static func split(_ segments: [TranscriptTimingSegment]) -> [Span]? {
        let blocks = makeBlocks(segments)
        guard blocks.count >= 2 else { return nil }

        // Every gap between blocks is a candidate: a silence always, words when the vocabulary
        // changes markedly there.
        struct Candidate { let block: Int; let silence: Bool; let score: Double }
        var candidates: [Candidate] = []
        let depths = depthScores(blocks)
        let lexical = depths.dropFirst().filter { $0 > 0 }
        let cutoff: Double = {
            guard !lexical.isEmpty else { return .infinity }
            let mean = lexical.reduce(0, +) / Double(lexical.count)
            let variance = lexical.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(lexical.count)
            return max(0.15, mean + variance.squareRoot() / 2)
        }()
        for index in 1..<blocks.count {
            if blocks[index].silenceBefore > 0 {
                candidates.append(Candidate(block: index, silence: true, score: blocks[index].silenceBefore))
            } else if depths[index] >= cutoff {
                candidates.append(Candidate(block: index, silence: false, score: depths[index]))
            }
        }
        // Silences first (the longest first), then the deepest changes of vocabulary.
        candidates.sort { ($0.silence ? 1 : 0, $0.score) > ($1.silence ? 1 : 0, $1.score) }

        let blockWordCounts = blocks.map(\.words)
        func words(_ from: Int, _ to: Int) -> Int { blockWordCounts[from..<to].reduce(0, +) }
        var cuts: [Int] = []
        for candidate in candidates where cuts.count + 1 < maximumTopics {
            let before = cuts.filter { $0 < candidate.block }.max() ?? 0
            let after = cuts.filter { $0 > candidate.block }.min() ?? blocks.count
            let minimum = candidate.silence ? minimumWordsBetweenSilences : minimumTopicWords
            guard words(before, candidate.block) >= minimum, words(candidate.block, after) >= minimum else { continue }
            cuts.append(candidate.block)
        }
        guard !cuts.isEmpty else { return nil }
        cuts.sort()

        let starts = [0] + cuts
        return starts.indices.map { i in
            let first = blocks[starts[i]]
            let lastBlock = i + 1 < starts.count ? starts[i + 1] - 1 : blocks.count - 1
            let segmentStart = i == 0 ? 0 : first.segments.lowerBound
            let segmentEnd = i + 1 < starts.count ? blocks[starts[i + 1]].segments.lowerBound : segments.count
            return Span(
                segments: segmentStart..<segmentEnd,
                start: first.start,
                end: blocks[lastBlock].end,
                words: words(starts[i], lastBlock + 1)
            )
        }
    }

    /// The spoken text of a span's segments.
    public static func text(of span: Span, in segments: [TranscriptTimingSegment]) -> String {
        segments[span.segments].map(SpeakerTurns.spokenText).filter { !$0.isEmpty }.joined(separator: " ")
    }

    // MARK: Presentation

    /// A topic note's title: the day it was recorded ("Saturday, November 21").
    public static func dateTitle(for date: Date) -> String {
        date.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    /// A topic note's one-line summary: how many topics, and their titles.
    public static func summary(of topics: [NoteTopic]) -> String {
        let titles = topics.map(\.title).filter { !$0.isEmpty }
        return "\(topics.count) topics: " + titles.joined(separator: " · ")
    }

    /// The clock time a topic starts at ("9:05 AM").
    public static func clockTime(of topic: NoteTopic, recordingStart: Date) -> String {
        recordingStart.addingTimeInterval(topic.start).formatted(date: .omitted, time: .shortened)
    }

    /// The note's cleaned text: each topic under a heading with its start time, its summary
    /// quoted and its text. What exports, search and sharing read.
    public static func markdown(of topics: [NoteTopic], recordingStart: Date) -> String {
        topics.map { topic in
            var lines = ["### \(clockTime(of: topic, recordingStart: recordingStart)) · \(topic.title)"]
            if !topic.summary.isEmpty { lines.append("> \(topic.summary)") }
            lines.append("")
            lines.append(topic.text)
            return lines.joined(separator: "\n")
        }
        .joined(separator: "\n\n")
    }

    // MARK: Blocks

    struct Block {
        var segments: Range<Int>
        var start: TimeInterval
        var end: TimeInterval
        var words: Int
        var terms: [String: Double]
        /// Seconds of silence before this block when it was cut at one, else 0.
        var silenceBefore: TimeInterval
    }

    /// The transcript in blocks of about `blockWords` spoken words, a block always ending at a
    /// long silence.
    static func makeBlocks(_ segments: [TranscriptTimingSegment]) -> [Block] {
        var blocks: [Block] = []
        var current: Block?
        var lastEnd: TimeInterval?
        for (index, segment) in segments.enumerated() {
            let words = SpeakerTurns.spokenText(segment).split(whereSeparator: \.isWhitespace)
            guard !words.isEmpty else { continue }
            let silence = lastEnd.map { segment.start - $0 } ?? 0
            lastEnd = max(lastEnd ?? 0, segment.end)
            if let block = current, block.words >= blockWords || silence >= silenceGap {
                blocks.append(block)
                current = nil
            }
            if current == nil {
                current = Block(segments: index..<(index + 1), start: segment.start, end: segment.end, words: 0, terms: [:],
                                silenceBefore: silence >= silenceGap ? silence : 0)
            }
            current!.segments = current!.segments.lowerBound..<(index + 1)
            current!.end = segment.end
            current!.words += words.count
            for word in words {
                if let term = term(String(word)) { current!.terms[term, default: 0] += 1 }
            }
        }
        if let current { blocks.append(current) }
        // A short last block is folded into the one before, unless a silence sets it apart.
        if blocks.count > 1, let last = blocks.last, last.words < blockWords / 3, last.silenceBefore == 0 {
            blocks.removeLast()
            blocks[blocks.count - 1].segments = blocks[blocks.count - 1].segments.lowerBound..<last.segments.upperBound
            blocks[blocks.count - 1].end = last.end
            blocks[blocks.count - 1].words += last.words
            for (term, count) in last.terms { blocks[blocks.count - 1].terms[term, default: 0] += count }
        }
        return blocks
    }

    /// For each gap (before block i, i ≥ 1; index 0 is unused), how much deeper the similarity
    /// of the vocabulary on either side dips there than at the peaks around it.
    static func depthScores(_ blocks: [Block]) -> [Double] {
        guard blocks.count >= 2 else { return Array(repeating: 0, count: blocks.count) }
        var similarity = Array(repeating: 0.0, count: blocks.count)
        for gap in 1..<blocks.count {
            let left = blocks[max(0, gap - window)..<gap]
            let right = blocks[gap..<min(blocks.count, gap + window)]
            similarity[gap] = cosine(merged(left), merged(right))
        }
        var depth = Array(repeating: 0.0, count: blocks.count)
        for gap in 1..<blocks.count {
            var leftPeak = similarity[gap]
            var i = gap - 1
            while i >= 1, similarity[i] >= leftPeak { leftPeak = similarity[i]; i -= 1 }
            var rightPeak = similarity[gap]
            i = gap + 1
            while i < blocks.count, similarity[i] >= rightPeak { rightPeak = similarity[i]; i += 1 }
            depth[gap] = (leftPeak - similarity[gap]) + (rightPeak - similarity[gap])
        }
        return depth
    }

    private static func merged(_ blocks: ArraySlice<Block>) -> [String: Double] {
        var terms: [String: Double] = [:]
        for block in blocks {
            for (term, count) in block.terms { terms[term, default: 0] += count }
        }
        return terms
    }

    static func cosine(_ a: [String: Double], _ b: [String: Double]) -> Double {
        let dot = a.reduce(0.0) { $0 + $1.value * (b[$1.key] ?? 0) }
        let normA = a.values.reduce(0) { $0 + $1 * $1 }.squareRoot()
        let normB = b.values.reduce(0) { $0 + $1 * $1 }.squareRoot()
        guard normA > 0, normB > 0 else { return 0 }
        return dot / (normA * normB)
    }

    /// A word as a vocabulary term: lowercased letters, a plural "s" dropped; nil for short
    /// words, stop words and fillers.
    static func term(_ word: String) -> String? {
        var letters = word.lowercased().filter { $0.isLetter || $0 == "'" }
        if let apostrophe = letters.firstIndex(of: "'") { letters = String(letters[..<apostrophe]) }
        guard letters.count >= 3, !stopWords.contains(letters) else { return nil }
        if letters.count > 4, letters.hasSuffix("s"), !letters.hasSuffix("ss") { letters.removeLast() }
        return letters
    }

    private static let stopWords: Set<String> = [
        "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her", "was", "one", "our", "out",
        "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two", "way", "who", "did", "its",
        "let", "put", "say", "she", "too", "use", "that", "with", "have", "this", "will", "your", "from", "they", "know",
        "want", "been", "good", "much", "some", "time", "very", "when", "come", "here", "just", "like", "long", "make",
        "many", "more", "only", "over", "such", "take", "than", "them", "well", "were", "what", "then", "there", "these",
        "thing", "things", "think", "those", "where", "which", "while", "would", "could", "should", "about", "after",
        "again", "also", "because", "before", "being", "even", "every", "going", "gonna", "got", "into", "kind", "look",
        "maybe", "might", "need", "okay", "other", "really", "right", "said", "same", "something", "still", "sure",
        "thank", "thanks", "their", "through", "today", "yeah", "yes", "yep", "nope", "actually", "basically", "mean",
        "pretty", "stuff", "lot", "lots", "back", "down", "doing", "does", "done", "don", "didn", "doesn", "isn", "wasn",
        "aren", "won", "can't", "cant", "dont", "didnt", "it's", "i'm", "that's", "there's", "we're", "they're", "you're",
        "uh", "um", "hmm", "mhm", "huh", "wow", "hey", "hello", "bye", "anyway", "though", "probably", "definitely",
        "able", "first", "last", "next", "most", "own", "why", "off", "yeah", "guess", "feel", "tell", "talk", "talking",
        "said", "says", "saying", "went", "goes", "came", "give", "gave", "made", "keep", "work", "around", "little",
        "big", "great", "nice", "real", "whole", "else", "ever", "never", "always", "sometimes", "somebody", "someone",
        "anything", "everything", "nothing", "everyone", "anyone", "people", "person", "guy", "guys", "way", "ones",
        "can", "may", "must", "shall", "let's", "lets", "gotta", "wanna", "kinda", "sorta", "yet", "already", "soon",
        "later", "now", "then", "once", "both", "each", "few", "less", "least", "enough", "quite", "rather", "almost",
    ]
}
