import Foundation

/// Plain-text tidying for transcripts and cleaned text: no model involved.
public enum TranscriptText {
    /// Removes the notes Whisper writes about non-speech in round brackets, such as
    /// "(speaking in foreign language)", "(silence)" or "(laughs)": a parenthesis of at most six
    /// words. Square-bracket tags are removed elsewhere (`sanitizeSpeechTranscript`). Also drops
    /// a "(" left open by them.
    public static func removingNonSpeechAnnotations(_ text: String) -> String {
        var result = text
        if let regex = try? NSRegularExpression(pattern: #"\(\s*([^()\s]+(?:\s+[^()\s]+){0,5})\s*\)"#) {
            result = regex.stringByReplacingMatches(in: result, range: NSRange(result.startIndex..., in: result), withTemplate: "")
        }
        if let stray = try? NSRegularExpression(pattern: #"\((?=\s|$)"#) {
            result = stray.stringByReplacingMatches(in: result, range: NSRange(result.startIndex..., in: result), withTemplate: "")
        }
        return collapsingSpaces(result)
    }

    /// Removes hesitation sounds (um, uh, erm, hmm) with the comma after them, capitalizing what
    /// then starts a sentence: "Um, mostly okay, uh, fine." -> "Mostly okay, fine."
    public static func removingFillerSounds(_ text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"(?i)(,\s*)?\b(?:um+|uh+|erm|hmm+)\b,?"#) else { return text }
        var result = regex.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "")
        result = collapsingSpaces(result)
            .replacingOccurrences(of: " ,", with: ",")
            .replacingOccurrences(of: " .", with: ".")
        // Capitalize the first letter of the text and of each sentence.
        var output = ""
        var capitalizeNext = true
        for character in result {
            if capitalizeNext, character.isLetter {
                output.append(contentsOf: character.uppercased())
                capitalizeNext = false
            } else {
                output.append(character)
                if ".!?".contains(character) { capitalizeNext = true } else if !character.isWhitespace { capitalizeNext = false }
            }
        }
        if output.hasPrefix(",") { output = String(output.dropFirst()).trimmingCharacters(in: .whitespaces) }
        return output
    }

    /// Whisper's mark for "someone else is talking now".
    public static let speakerChangeMarker = ">>"

    /// Breaks text into paragraphs: a new one at every existing paragraph break and every
    /// speaker-change mark (`>>`, then removed), and otherwise after `maxSentences` sentences or
    /// about `maxWords` words, always at the end of a sentence. A short last paragraph joins the
    /// one before it. Paragraphs are separated by a blank line.
    public static func paragraphed(_ text: String, maxSentences: Int = 5, maxWords: Int = 90) -> String {
        var paragraphs: [String] = []
        let blocks = text
            .components(separatedBy: "\n")
            .flatMap { $0.components(separatedBy: speakerChangeMarker) }
            .map { collapsingSpaces($0) }
            .filter { !$0.isEmpty }
        for block in blocks {
            paragraphs += split(block, maxSentences: maxSentences, maxWords: maxWords)
        }
        return paragraphs.joined(separator: "\n\n")
    }

    private static func split(_ block: String, maxSentences: Int, maxWords: Int) -> [String] {
        var sentences: [String] = []
        block.enumerateSubstrings(in: block.startIndex..<block.endIndex, options: .bySentences) { substring, _, _, _ in
            guard let sentence = substring?.trimmingCharacters(in: .whitespacesAndNewlines), !sentence.isEmpty else { return }
            // An unpunctuated run-on is one "sentence": cut it into word windows.
            let words = sentence.split(whereSeparator: \.isWhitespace)
            if words.count > maxWords {
                stride(from: 0, to: words.count, by: maxWords).forEach {
                    sentences.append(words[$0..<min($0 + maxWords, words.count)].joined(separator: " "))
                }
            } else {
                sentences.append(sentence)
            }
        }

        var paragraphs: [[String]] = []
        var current: [String] = []
        var words = 0
        for sentence in sentences {
            let count = sentence.split(whereSeparator: \.isWhitespace).count
            if !current.isEmpty && (current.count >= maxSentences || words + count > maxWords) {
                paragraphs.append(current)
                current = []
                words = 0
            }
            current.append(sentence)
            words += count
        }
        if !current.isEmpty {
            // A short tail reads better as the end of the paragraph before it.
            if let last = paragraphs.last, current.count < 2, words < maxWords / 3,
               last.joined(separator: " ").split(whereSeparator: \.isWhitespace).count + words <= maxWords + maxWords / 3 {
                paragraphs[paragraphs.count - 1] += current
            } else {
                paragraphs.append(current)
            }
        }
        return paragraphs.map { $0.joined(separator: " ") }
    }

    static func collapsingSpaces(_ text: String) -> String {
        text.split(whereSeparator: { $0 == " " || $0 == "\t" }).joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
