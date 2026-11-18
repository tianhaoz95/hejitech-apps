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
