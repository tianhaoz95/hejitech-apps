import Foundation

/// A stretch of a recording one person talks in, from speaker detection: seconds from the start
/// of the note's audio, and a speaker number shared across the whole recording.
public struct SpeakerSpan: Codable, Hashable, Sendable {
    public let start: TimeInterval
    public let end: TimeInterval
    public let speaker: Int

    public init(start: TimeInterval, end: TimeInterval, speaker: Int) {
        self.start = start
        self.end = end
        self.speaker = speaker
    }
}

/// One person's turn in a conversation note: what they said before someone else spoke. Speakers
/// are numbered from 0 in the order they first speak.
public struct SpeakerTurn: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var speaker: Int
    public var start: TimeInterval
    public var text: String

    public init(id: UUID = UUID(), speaker: Int, start: TimeInterval, text: String) {
        self.id = id
        self.speaker = speaker
        self.start = start
        self.text = text
    }
}

/// Turning speaker detection and a timed transcript into conversation turns. No model involved.
public enum SpeakerTurns {
    /// A speaker with fewer words than this over the whole recording is taken to be a detection
    /// error (a cough, a voice in the background) and their words go to whoever spoke before.
    public static let minimumWordsPerSpeaker = 5

    /// Each segment's speaker: the span it overlaps most, or nil when it overlaps none.
    public static func assign(_ segments: [TranscriptTimingSegment], spans: [SpeakerSpan]) -> [TranscriptTimingSegment] {
        segments.map { segment in
            var best: (speaker: Int, overlap: TimeInterval)?
            for span in spans {
                let overlap = min(segment.end, span.end) - max(segment.start, span.start)
                if overlap > 0, overlap > (best?.overlap ?? 0) {
                    best = (span.speaker, overlap)
                }
            }
            var assigned = segment
            assigned.speaker = best?.speaker
            return assigned
        }
    }

    /// How many people speak in these segments (after dropping speakers with too few words).
    public static func speakerCount(in segments: [TranscriptTimingSegment]) -> Int {
        Set(resolvedSpeakers(segments).compactMap { $0 }).count
    }

    /// The conversation's turns, speakers renumbered by first appearance, or none when fewer than
    /// two people speak (a memo, or no speaker detection).
    public static func turns(from segments: [TranscriptTimingSegment]) -> [SpeakerTurn] {
        let speakers = resolvedSpeakers(segments)
        guard Set(speakers.compactMap { $0 }).count >= 2 else { return [] }

        var turns: [SpeakerTurn] = []
        var numbering: [Int: Int] = [:]
        for (segment, speaker) in zip(segments, speakers) {
            let text = segment.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let speaker, !text.isEmpty else { continue }
            let number = numbering[speaker] ?? {
                let next = numbering.count
                numbering[speaker] = next
                return next
            }()
            if let last = turns.last, last.speaker == number {
                turns[turns.count - 1].text += " " + text
            } else {
                turns.append(SpeakerTurn(speaker: number, start: segment.start, text: text))
            }
        }
        return turns
    }

    /// Per segment: its speaker, with gaps (no overlap) and speakers below the word minimum given
    /// to the speaker before them (the first speaker for any at the start).
    private static func resolvedSpeakers(_ segments: [TranscriptTimingSegment]) -> [Int?] {
        var speakers = segments.map(\.speaker)
        guard speakers.contains(where: { $0 != nil }) else { return speakers }

        var words: [Int: Int] = [:]
        for (segment, speaker) in zip(segments, speakers) {
            guard let speaker else { continue }
            words[speaker, default: 0] += segment.text.split(whereSeparator: \.isWhitespace).count
        }
        let kept = Set(words.filter { $0.value >= minimumWordsPerSpeaker }.keys)
        guard !kept.isEmpty else { return speakers.map { _ in nil } }

        var previous: Int?
        for index in speakers.indices {
            if let speaker = speakers[index], kept.contains(speaker) {
                previous = speaker
            } else {
                speakers[index] = previous
            }
        }
        let first = speakers.first { $0 != nil } ?? nil
        for index in speakers.indices where speakers[index] == nil {
            speakers[index] = first
        }
        return speakers
    }
}

/// Matches speakers across the windows a long recording is detected in, by how alike their
/// voices are (each window's per-speaker voice embedding). Measured on SpeakerKit's embeddings:
/// the same voice in two windows ~0.09 apart (cosine distance), two different voices ~0.7.
public struct SpeakerLinker: Sendable {
    public static let sameSpeakerDistance: Float = 0.45

    private var centroids: [[Float]] = []
    private var weights: [Float] = []

    public init() {}

    public var speakerCount: Int { centroids.count }

    /// Maps one window's speakers (local id -> voice embedding) to recording-wide numbers,
    /// adding a speaker for any voice not heard before. Two speakers of one window never map to
    /// the same number.
    public mutating func link(_ window: [Int: [Float]]) -> [Int: Int] {
        var mapping: [Int: Int] = [:]
        var taken = Set<Int>()
        for (local, embedding) in window.sorted(by: { $0.key < $1.key }) {
            var best: (index: Int, distance: Float)?
            for (index, centroid) in centroids.enumerated() where !taken.contains(index) && centroid.count == embedding.count {
                let distance = Self.cosineDistance(centroid, embedding)
                if distance < Self.sameSpeakerDistance, distance < (best?.distance ?? .infinity) {
                    best = (index, distance)
                }
            }
            if let best {
                mapping[local] = best.index
                // Running mean, so a voice's estimate firms up over the recording.
                let weight = weights[best.index]
                centroids[best.index] = zip(centroids[best.index], embedding).map { ($0 * weight + $1) / (weight + 1) }
                weights[best.index] = weight + 1
            } else {
                mapping[local] = centroids.count
                centroids.append(embedding)
                weights.append(1)
            }
            taken.insert(mapping[local]!)
        }
        return mapping
    }

    /// A speaker with no voice embedding: a new number of its own.
    public mutating func newSpeaker() -> Int {
        centroids.append([])
        weights.append(0)
        return centroids.count - 1
    }

    static func cosineDistance(_ a: [Float], _ b: [Float]) -> Float {
        var dot: Float = 0, normA: Float = 0, normB: Float = 0
        for index in 0..<min(a.count, b.count) {
            dot += a[index] * b[index]
            normA += a[index] * a[index]
            normB += b[index] * b[index]
        }
        guard normA > 0, normB > 0 else { return 1 }
        return 1 - dot / (normA.squareRoot() * normB.squareRoot())
    }
}
