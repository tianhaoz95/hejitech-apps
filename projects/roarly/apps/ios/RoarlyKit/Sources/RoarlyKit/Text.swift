import Foundation

/// A word of the transcript, normalized for matching, with whether a clause break follows it.
public struct Token: Equatable, Sendable {
    public let text: String
    /// Punctuation (. , ! ? ;) or a dash ends the clause after this word.
    public let endsClause: Bool
    /// . ! ? ends the sentence after this word.
    public let endsSentence: Bool

    public init(text: String, endsClause: Bool = false, endsSentence: Bool = false) {
        self.text = text
        self.endsClause = endsClause || endsSentence
        self.endsSentence = endsSentence
    }
}

public enum TextNormalizer {
    /// Lowercased words without punctuation; "lion's" → "lion", "T-Rex" → "t", "rex".
    public static func tokens(_ text: String) -> [Token] {
        var result: [Token] = []
        var current = ""
        func flush(endsClause: Bool, endsSentence: Bool = false) {
            if !current.isEmpty {
                var word = current.replacingOccurrences(of: "’", with: "'")
                if word.hasSuffix("'s") { word = String(word.dropLast(2)) }
                word = word.trimmingCharacters(in: CharacterSet(charactersIn: "'"))
                if !word.isEmpty { result.append(Token(text: word, endsClause: endsClause, endsSentence: endsSentence)) }
                current = ""
            } else if endsClause, let last = result.last {
                result[result.count - 1] = Token(text: last.text, endsClause: true, endsSentence: last.endsSentence || endsSentence)
            }
        }
        for ch in text.lowercased() {
            if ch.isLetter || ch.isNumber || ch == "'" || ch == "’" {
                current.append(ch)
            } else if ".!?…".contains(ch) {
                flush(endsClause: true, endsSentence: true)
            } else if ",;:—–\"“”()".contains(ch) {
                flush(endsClause: true)
            } else {
                flush(endsClause: false)
            }
        }
        flush(endsClause: false)
        return result
    }

    public static func words(_ phrase: String) -> [String] { tokens(phrase).map(\.text) }

    /// Whether a transcript word is the trigger word or a simple inflection of it
    /// ("lions", "foxes", "puppies", "kitty's").
    public static func matches(_ word: String, _ trigger: String) -> Bool {
        if word == trigger { return true }
        if word == trigger + "s" || word == trigger + "es" { return true }
        if trigger.hasSuffix("y"), word == trigger.dropLast() + "ies" { return true }
        if trigger.hasSuffix("f"), word == trigger.dropLast() + "ves" { return true }
        return false
    }
}
