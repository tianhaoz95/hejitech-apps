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
    static let negations: Set<String> = ["no", "not", "never", "without", "nobody", "none", "nothing", "neither", "nor", "isn't", "wasn't", "weren't", "aren't", "didn't", "doesn't", "don't", "won't", "couldn't", "can't", "cannot", "hasn't", "haven't"]
    static let departures: [[String]] = [
        ["away"], ["gone"], ["left"], ["leaving"], ["disappeared"], ["vanished"], ["hid"], ["hiding"],
        ["asleep"], ["sleeping"], ["slept"], ["quiet"], ["quietly"], ["silent"], ["silently"],
        ["went", "home"], ["said", "goodbye"], ["far"], ["escaped"], ["no", "longer"], ["anymore"],
        ["used", "to"], ["remember"], ["once", "saw"], ["stopped"], ["dreaming"], ["dreamed"], ["dreamt"],
    ]
    static let arrivals: [[String]] = [
        ["came"], ["comes"], ["coming"], ["appeared"], ["appears"], ["jumped"], ["jumps"], ["leaped"], ["leapt"],
        ["chased"], ["chasing"], ["chases"], ["toward"], ["towards"], ["closer"], ["suddenly"], ["opened"],
        ["big"], ["huge"], ["giant"], ["loud"], ["loudly"], ["angry"], ["scary"], ["hungry"], ["attacked"],
        ["pounced"], ["here"], ["there", "was"], ["there", "is"], ["there", "lived"], ["lived"], ["saw"], ["see"],
        ["look"], ["looked"], ["said"], ["says"], ["shouted"], ["yelled"], ["called"], ["woke", "up"], ["wakes", "up"],
        ["started"], ["began"], ["out", "came"], ["popped", "out"], ["burst"], ["ran", "after"], ["running", "after"],
        ["behind", "you"], ["right", "behind"], ["walked", "in"], ["walked", "up"], ["sneaking", "up"], ["crept", "up"],
        ["it", "a"], ["it", "was", "a"], ["met"], ["meets"], ["found"], ["heard"], ["listen"],
    ]
    /// Before the mention: the story is remembering or imagining it, not meeting it.
    static let memories: [[String]] = [["remember"], ["remembered"], ["used", "to"], ["once", "saw"], ["dreamed", "of"], ["dreamt", "of"], ["dreaming", "of"], ["wished"], ["missed"], ["pretend"], ["imagine"], ["picture"]]
    /// "what does the cow say?", "what sound does a duck make?": the child is asking to hear it.
    static let askingForSound: [[String]] = [["what", "does"], ["what", "sound"], ["what", "noise"], ["how", "does"]]
    static let soundAsk: [[String]] = [["say"], ["sound"], ["noise"], ["go"], ["make"]]

    /// Judges the mention at `mention.range` in `tokens` (one utterance). `isFinal` says whether
    /// the speaker finished it.
    public static func judge(_ mention: Mention, in tokens: [Token], isFinal: Bool, soundWords: [String]) -> Judgement {
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
            if start - sentenceStart >= 12 { break }
        }
        let after = Array(words[end..<min(words.count, end + 10)])
        let before = Array(words[sentenceStart..<start])
        let window = before + after

        // Negation right before ("no lion", "wasn't a lion", "never saw a lion").
        // "Oh no, a tiger!" is alarm, not negation: a "no" closing its own clause doesn't count.
        let negated = (max(sentenceStart, start - 4)..<start).contains { i in
            let w = words[i]
            guard negations.contains(w) || w.hasSuffix("n't") else { return false }
            if tokens[i].endsClause { return false }
            if i > 0, ["oh", "uh"].contains(words[i - 1]) { return false }
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
        if soundTokens.contains(where: { contains(window, $0) }) {
            reasons.append("its sound named nearby")
            return Judgement(score: 0.95, isProvisional: false, reasons: reasons)
        }
        if askingForSound.contains(where: { contains(before, $0) }) && soundAsk.contains(where: { contains(after.prefix(3).map { $0 }, $0) }) {
            reasons.append("asked what it says")
            return Judgement(score: 0.95, isProvisional: false, reasons: reasons)
        }

        var score = 0.55
        let leaving = departures.contains { contains(after, $0) } || memories.contains { contains(before, $0) }
        let coming = arrivals.contains { contains(window, $0) }
        if coming { score += 0.25; reasons.append("arriving or acting") }
        if leaving {
            score = coming ? 0.35 : 0.18
            reasons.append("leaving or quiet")
        }
        // Few words after the mention so far: the next ones may still turn it around.
        let provisional = !isFinal && after.count < 4
        return Judgement(score: min(score, 0.9), isProvisional: provisional, reasons: reasons)
    }

    static func contains(_ words: [String], _ phrase: [String]) -> Bool {
        guard !phrase.isEmpty, phrase.count <= words.count else { return false }
        for i in 0...(words.count - phrase.count) where zip(words[i..<(i + phrase.count)], phrase).allSatisfy({ TextNormalizer.matches($0, $1) }) {
            return true
        }
        return false
    }
}
