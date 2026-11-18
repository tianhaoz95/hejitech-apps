import Foundation

/// Where the transcript brings a sound to mind.
public struct Mention: Equatable, Sendable {
    public let cueID: String
    /// Token index range of the matched phrase.
    public let range: Range<Int>
    /// The phrase was one of the cue's sound words ("roared"), not just its name.
    public let isSoundWord: Bool
}

/// Finds the catalog's words in a transcript. Custom words from the parent count as triggers.
public struct CueMatcher: Sendable {
    struct Phrase: Sendable {
        let cueID: String
        let words: [String]
        let isSoundWord: Bool
    }

    private let phrases: [Phrase]
    /// Sound words that belong to exactly one cue ("woof" → dog); the others ("roared") need a
    /// recent mention to say whose sound it is.
    private let uniqueSoundWords: Set<String>

    public init(cues: [Cue] = SoundCatalog.all, customTriggers: [String: [String]] = [:]) {
        var phrases: [Phrase] = []
        var soundWordOwners: [String: Set<String>] = [:]
        for cue in cues {
            let soundPhrases = Set(cue.soundWords.map { TextNormalizer.words($0).joined(separator: " ") })
            for t in cue.triggers + (customTriggers[cue.id] ?? []) {
                let w = TextNormalizer.words(t)
                // A trigger that is also the sound ("knock knock", "snoring") is the sound itself.
                if !w.isEmpty { phrases.append(Phrase(cueID: cue.id, words: w, isSoundWord: soundPhrases.contains(w.joined(separator: " ")))) }
            }
            for s in cue.soundWords {
                let w = TextNormalizer.words(s)
                guard !w.isEmpty else { continue }
                phrases.append(Phrase(cueID: cue.id, words: w, isSoundWord: true))
                soundWordOwners[w.joined(separator: " "), default: []].insert(cue.id)
            }
        }
        // Longer phrases first so "grizzly bear" wins over "bear" and "knock knock" over "knock".
        self.phrases = phrases.sorted { $0.words.count > $1.words.count }
        self.uniqueSoundWords = Set(soundWordOwners.filter { $0.value.count == 1 }.keys)
    }

    /// Every mention, left to right. A sound word shared by several cues ("roared") goes to
    /// whichever of them was mentioned last (in this text or `recentCueIDs`, newest last); with
    /// none of them in mind it is dropped.
    public func mentions(in tokens: [Token], recentCueIDs: [String] = []) -> [Mention] {
        let words = tokens.map(\.text)
        var taken = Array(repeating: false, count: words.count)
        var found: [Mention] = []
        for phrase in phrases {
            let n = phrase.words.count
            guard n <= words.count else { continue }
            var i = 0
            while i + n <= words.count {
                if !taken[i..<(i + n)].contains(true), zip(words[i..<(i + n)], phrase.words).allSatisfy({ TextNormalizer.matches($0, $1) }) {
                    found.append(Mention(cueID: phrase.cueID, range: i..<(i + n), isSoundWord: phrase.isSoundWord))
                    for k in i..<(i + n) { taken[k] = true }
                    i += n
                } else {
                    i += 1
                }
            }
        }
        found.sort { $0.range.lowerBound < $1.range.lowerBound }

        // Resolve shared sound words to their owner in context.
        var resolved: [Mention] = []
        var context = recentCueIDs
        let ownersByWord = Dictionary(grouping: phrases.filter(\.isSoundWord), by: { $0.words.joined(separator: " ") })
            .mapValues { Set($0.map(\.cueID)) }
        for m in found {
            if !m.isSoundWord {
                resolved.append(m)
                context.append(m.cueID)
                continue
            }
            let key = words[m.range].joined(separator: " ")
            let owners = ownersByWord[phraseKey(for: key, in: ownersByWord)] ?? [m.cueID]
            if owners.count == 1 || uniqueSoundWords.contains(key) {
                resolved.append(m)
                context.append(m.cueID)
            } else if let owner = context.last(where: { owners.contains($0) }) {
                resolved.append(Mention(cueID: owner, range: m.range, isSoundWord: true))
            }
        }
        return resolved
    }

    /// The owners table is keyed by the catalog's spelling; transcript words may be inflected.
    private func phraseKey(for key: String, in table: [String: Set<String>]) -> String {
        if table[key] != nil { return key }
        let parts = key.split(separator: " ").map(String.init)
        return table.keys.first { candidate in
            let c = candidate.split(separator: " ").map(String.init)
            return c.count == parts.count && zip(parts, c).allSatisfy { TextNormalizer.matches($0, $1) }
        } ?? key
    }
}
