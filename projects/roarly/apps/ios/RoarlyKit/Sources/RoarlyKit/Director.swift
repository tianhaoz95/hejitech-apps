import Foundation

/// The question a small language model answers about an unsure mention, and how its answer is read.
///
/// Kept to one yes/no so the bundled 0.6B model answers in a few tokens (≈ 0.2–0.5 s on an iPhone
/// 13) and Apple's on-device model the same way.
public enum DirectorPrompt {
    public static let instructions = """
    You add sound effects while a parent tells a children's story out loud. \
    For the sound named, decide whether it should play right now. \
    Answer yes if the thing is here now: arriving, appearing, chasing, acting or making its noise. \
    Answer no if it is leaving, running away, gone, asleep, quiet, far away, only imagined, negated, or just being talked about. \
    The story may be told in any language; always reply in English. \
    Reply with one word: yes or no.
    """

    public static func question(for review: StoryEngine.Review) -> String {
        let name = SoundCatalog.cue(review.cueID)?.name.lowercased() ?? review.cueID
        var lines: [String] = []
        if !review.story.isEmpty { lines.append("Story so far: " + review.story.joined(separator: " ")) }
        lines.append("Just said: \"\(review.utterance)\"")
        lines.append("Sound: the \(name)")
        lines.append("Play it now? yes or no")
        return lines.joined(separator: "\n")
    }

    /// The utterance as the on-device classifier (ml/train.swift) sees it: the sound's own words
    /// replaced by THING, so one model covers every sound ("THING is running away").
    public static func masked(_ review: StoryEngine.Review, customWords: [String] = []) -> String {
        guard let cue = SoundCatalog.cue(review.cueID) else { return review.utterance }
        let phrases = (StoryLanguage.english.lexicon.words(for: cue).triggers + customWords).sorted { $0.count > $1.count }
        var text = review.utterance
        for p in phrases {
            let word: String
            if p.hasSuffix("y") { word = NSRegularExpression.escapedPattern(for: String(p.dropLast())) + "(y|ies)" }
            else if p.hasSuffix("f") { word = NSRegularExpression.escapedPattern(for: String(p.dropLast())) + "(f|ves)" }
            else { word = NSRegularExpression.escapedPattern(for: p) + "(s|es)?" }
            let pattern = "\\b" + word + "\\b"
            text = text.replacingOccurrences(of: pattern, with: "THING", options: [.regularExpression, .caseInsensitive])
        }
        return text
    }

    /// `true`/`false`, or `nil` when the reply says neither.
    public static func parse(_ reply: String) -> Bool? {
        var text = reply.lowercased()
        if let end = text.range(of: "</think>") { text = String(text[end.upperBound...]) }
        let words = TextNormalizer.words(text)
        for w in words {
            if w == "yes" || w == "true" || w == "play" { return true }
            if w == "no" || w == "false" || w == "skip" { return false }
        }
        return nil
    }
}
