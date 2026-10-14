import Foundation

/// Processes in-speech verbal editing commands (e.g. "scratch that", "action item: ...", "title: ...")
/// before structuring, allowing users to verbally fix mistakes while dictating.
public struct ProcessedVoiceCommands: Equatable, Sendable {
    public var cleanedTranscript: String
    public var explicitTitle: String?
    public var extractedActionItems: [String]

    public init(cleanedTranscript: String, explicitTitle: String? = nil, extractedActionItems: [String] = []) {
        self.cleanedTranscript = cleanedTranscript
        self.explicitTitle = explicitTitle
        self.extractedActionItems = extractedActionItems
    }
}

public enum VoiceCommandProcessor {
    private static let scratchPhrases = [
        "scratch that",
        "strike that",
        "delete that",
        "forget that",
        "never mind that"
    ]

    /// Processes voice commands within a transcript.
    public static func process(_ transcript: String) -> ProcessedVoiceCommands {
        var currentText = transcript
        var extractedTitle: String? = nil
        var extractedActions: [String] = []

        // 1. Process explicit title command if present at the start or end
        // e.g. "Title: Project Kickoff." or "Title is Project Kickoff."
        let titlePatterns = [
            #"(?i)^(?:title\s*(?:is|:)|call\s+this)\s+([^.\n]+)[.\n]?"#,
            #"(?i)[.\n]\s*(?:title\s*(?:is|:)|call\s+this)\s+([^.\n]+)$"#
        ]
        for pattern in titlePatterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                let range = NSRange(currentText.startIndex..<currentText.endIndex, in: currentText)
                if let match = regex.firstMatch(in: currentText, options: [], range: range),
                   let titleRange = Range(match.range(at: 1), in: currentText),
                   let fullRange = Range(match.range(at: 0), in: currentText) {
                    let titleCandidate = String(currentText[titleRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !titleCandidate.isEmpty {
                        extractedTitle = titleCandidate
                        currentText.removeSubrange(fullRange)
                        currentText = currentText.trimmingCharacters(in: .whitespacesAndNewlines)
                        break
                    }
                }
            }
        }

        // 2. Process explicit action items ("Action item: [something]" or "Todo: [something]")
        let actionPattern = #"(?i)(?:action\s+item|to[\s-]?do)\s*:\s*([^.\n]+)[.\n]?"#
        if let regex = try? NSRegularExpression(pattern: actionPattern, options: []) {
            let matches = regex.matches(in: currentText, options: [], range: NSRange(currentText.startIndex..<currentText.endIndex, in: currentText))
            for match in matches {
                if let itemRange = Range(match.range(at: 1), in: currentText) {
                    let item = String(currentText[itemRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !item.isEmpty && !extractedActions.contains(item) {
                        extractedActions.append(item)
                    }
                }
            }
        }

        // 3. Process scratch/strike-that cancellation commands
        currentText = applyScratchCommands(to: currentText)

        return ProcessedVoiceCommands(
            cleanedTranscript: currentText.trimmingCharacters(in: .whitespacesAndNewlines),
            explicitTitle: extractedTitle,
            extractedActionItems: extractedActions
        )
    }

    /// Strips the clause or sentence immediately preceding phrases like "scratch that"
    private static func applyScratchCommands(to text: String) -> String {
        var working = text
        for phrase in scratchPhrases {
            let pattern = "(?i)(?:[;,.]|^)([^;,.\\n]+?)[,.]?\\s*" + NSRegularExpression.escapedPattern(for: phrase) + "[;,.]?\\s*"
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                while let match = regex.firstMatch(in: working, options: [], range: NSRange(working.startIndex..<working.endIndex, in: working)),
                      let fullRange = Range(match.range(at: 0), in: working) {
                    // Check if there was punctuation at start of match
                    let matchedString = String(working[fullRange])
                    var replacement = ""
                    if matchedString.hasPrefix(".") {
                        replacement = ". "
                    } else if matchedString.hasPrefix(";") {
                        replacement = "; "
                    }
                    working.replaceSubrange(fullRange, with: replacement)
                }
            }
        }
        // Clean up accidental multiple spaces or leading punctuation
        working = working.replacingOccurrences(of: #"\s{2,}"#, with: " ", options: .regularExpression)
        working = working.replacingOccurrences(of: #"^\s*[,;.]\s*"#, with: "", options: .regularExpression)
        working = working.trimmingCharacters(in: .whitespacesAndNewlines)
        if let first = working.first {
            working = first.uppercased() + working.dropFirst()
        }
        return working
    }
}
