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
    /// Lowercased words without punctuation or accents; "lion's" → "lion", "T-Rex" → "t", "rex",
    /// "León" → "leon". Every Han character is a token of its own (Chinese has no spaces), and
    /// Traditional characters become Simplified, so "獅子" and "狮子" are both "狮", "子".
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
        var source = text.lowercased().folding(options: .diacriticInsensitive, locale: nil)
        if source.unicodeScalars.contains(where: isHan) {
            source = source.applyingTransform(StringTransform("Hant-Hans"), reverse: false) ?? source
        }
        for ch in source {
            if let scalar = ch.unicodeScalars.first, isHan(scalar) {
                flush(endsClause: false)
                result.append(Token(text: String(ch)))
            } else if ch.isLetter || ch.isNumber || ch == "'" || ch == "’" {
                current.append(ch)
            } else if ".!?…。！？".contains(ch) {
                flush(endsClause: true, endsSentence: true)
            } else if ",;:—–\"“”()，、；：「」『』（）《》".contains(ch) {
                flush(endsClause: true)
            } else {
                flush(endsClause: false)
            }
        }
        flush(endsClause: false)
        return result
    }

    public static func words(_ phrase: String) -> [String] { tokens(phrase).map(\.text) }

    static func isHan(_ s: Unicode.Scalar) -> Bool {
        switch s.value {
        case 0x3400...0x4DBF, 0x4E00...0x9FFF, 0xF900...0xFAFF, 0x20000...0x2EBEF: return true
        default: return false
        }
    }

    /// Whether a transcript word is the trigger word or one of its plurals, by the language's
    /// (singular ending, plural ending) rules: ("", "s") "lions", ("y", "ies") "puppies".
    public static func matches(_ word: String, _ trigger: String, plurals: [(String, String)] = StoryLanguage.english.lexicon.plurals) -> Bool {
        if word == trigger { return true }
        for (singular, plural) in plurals where trigger.hasSuffix(singular) {
            if word == trigger.dropLast(singular.count) + plural { return true }
        }
        return false
    }
}
