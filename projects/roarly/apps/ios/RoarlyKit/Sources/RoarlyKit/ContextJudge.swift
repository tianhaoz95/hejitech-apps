import Foundation

/// How sure the listener is that a mention should make its sound now, from the words around it.
///
/// It reads the clause the way a storyteller means it: "a tiger is chasing you" (coming, acting:
/// play), "the tiger is running away" (leaving: don't), "there was no lion" (negated: don't),
/// "the lion opened his mouth and roared" (the sound itself: certain). A small language model can
/// review the unsure middle (`StoryEngine.Review`); this judge alone must already be good.
public struct Judgement: Equatable, Sendable {
    public let score: Double
    /// The words after the mention could still change the answer (the speaker hasn't finished).
    public let isProvisional: Bool
    public let reasons: [String]
}

public enum ContextJudge {
    /// Judges the mention at `mention.range` in `tokens` (one utterance). `isFinal` says whether
    /// the speaker finished it.
    public static func judge(_ mention: Mention, in tokens: [Token], isFinal: Bool, soundWords: [String], language: StoryLanguage = .english) -> Judgement {
        let lex = language.lexicon
        var reasons: [String] = []
        let words = tokens.map(\.text)
        let start = mention.range.lowerBound
        let end = mention.range.upperBound

        // The sentence around the mention: back to the previous sentence end, forward to the next
        // mention-free stretch of up to 10 words (clauses joined by "but", "and" still count:
        // "the tiger came but then ran away").
        var sentenceStart = start
        while sentenceStart > 0 {
            if tokens[sentenceStart - 1].endsSentence { break }
            sentenceStart -= 1
            if start - sentenceStart >= lex.lookbehind { break }
        }
        let after = Array(words[end..<min(words.count, end + lex.lookahead)])
        let before = Array(words[sentenceStart..<start])
        let window = before + after

        // Negation right before ("no lion", "wasn't a lion", "never saw a lion").
        // "Oh no, a tiger!" is alarm, not negation: a "no" closing its own clause doesn't count.
        let negated = (max(sentenceStart, start - lex.negationReach)..<start).contains { i in
            let w = words[i]
            let rest = Array(words[i..<start])
            guard let phrase = lex.negations.filter({ startsWith(rest, $0) }).max(by: { $0.count < $1.count })
                    ?? (lex.negationSuffixes.contains { w.hasSuffix($0) } ? [w] : nil) else { return false }
            if lex.notNegations.contains(where: { startsWith(Array(words[i...]), $0) }) { return false }
            if tokens[i + phrase.count - 1].endsClause { return false }
            if i > 0, lex.interjections.contains(words[i - 1]) { return false }
            return true
        }
        if negated {
            reasons.append("negated")
            return Judgement(score: 0.05, isProvisional: false, reasons: reasons)
        }

        // The sound itself.
        if mention.isSoundWord {
            reasons.append("sound word")
            return Judgement(score: 0.96, isProvisional: false, reasons: reasons)
        }
        let soundTokens = soundWords.map(TextNormalizer.words)
        if soundTokens.contains(where: { contains(window, $0, lex) }) {
            reasons.append("its sound named nearby")
            return Judgement(score: 0.95, isProvisional: false, reasons: reasons)
        }
        let askedBefore = lex.askBefore.isEmpty || lex.askBefore.contains { contains(before, $0, lex) }
        let askedAfter = lex.askAfter.isEmpty || lex.askAfter.contains { contains(Array(after.prefix(lex.settledAfter + 2)), $0, lex) }
        if askedBefore && askedAfter && !(lex.askBefore.isEmpty && lex.askAfter.isEmpty) {
            reasons.append("asked what it says")
            return Judgement(score: 0.95, isProvisional: false, reasons: reasons)
        }

        var score = 0.55
        let leaving = lex.departures.contains { contains(after, $0, lex) } || lex.memories.contains { contains(before, $0, lex) }
        let coming = lex.arrivals.contains { contains(window, $0, lex) }
        if coming { score += 0.25; reasons.append("arriving or acting") }
        if leaving {
            score = coming ? 0.35 : 0.18
            reasons.append("leaving or quiet")
        }
        // Few words after the mention so far: the next ones may still turn it around.
        let provisional = !isFinal && after.count < lex.settledAfter
        return Judgement(score: min(score, 0.9), isProvisional: provisional, reasons: reasons)
    }

    static func startsWith(_ words: [String], _ phrase: [String]) -> Bool {
        phrase.count <= words.count && zip(words, phrase).allSatisfy { $0 == $1 }
    }

    static func contains(_ words: [String], _ phrase: [String], _ lex: Lexicon = StoryLanguage.english.lexicon) -> Bool {
        guard !phrase.isEmpty, phrase.count <= words.count else { return false }
        for i in 0...(words.count - phrase.count) where zip(words[i..<(i + phrase.count)], phrase).allSatisfy({ lex.matches($0, $1) }) {
            return true
        }
        return false
    }
}
