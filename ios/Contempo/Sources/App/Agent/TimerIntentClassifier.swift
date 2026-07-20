import Foundation

public enum TimerIntent: Sendable {
    case start
    case stop
}

/// Deterministic classifier to detect "starting work" / "finished work" intent from voice input.
public enum TimerIntentClassifier {
    private static let preamble = "(?:\\S+\\s+){0,3}?"

    private static let startRegexes: [NSRegularExpression] = [
        try! NSRegularExpression(pattern: "^\(preamble)\\bi('m| am)\\s+(now\\s+)?start(ing)?\\b", options: .caseInsensitive),
        try! NSRegularExpression(pattern: "^\(preamble)\\b(starting|beginning) (to )?work\\b", options: .caseInsensitive),
        try! NSRegularExpression(pattern: "^\(preamble)\\bclock(ing)? in\\b", options: .caseInsensitive),
    ]

    private static let stopRegexes: [NSRegularExpression] = [
        try! NSRegularExpression(pattern: "^\(preamble)\\bi('m| am)\\s+(now\\s+)?(done|finished)\\b", options: .caseInsensitive),
        try! NSRegularExpression(pattern: "^\(preamble)\\b(just )?(finished|wrapped up|wrapping up)\\b", options: .caseInsensitive),
        try! NSRegularExpression(pattern: "^\(preamble)\\bclock(ing)? out\\b", options: .caseInsensitive),
        try! NSRegularExpression(pattern: "^\(preamble)\\bstopping\\b", options: .caseInsensitive),
    ]

    public static func classify(_ rawText: String) -> TimerIntent? {
        let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let range = NSRange(location: 0, length: trimmed.utf16.count)
        for regex in startRegexes {
            if regex.firstMatch(in: trimmed, options: [], range: range) != nil {
                return .start
            }
        }
        for regex in stopRegexes {
            if regex.firstMatch(in: trimmed, options: [], range: range) != nil {
                return .stop
            }
        }
        return nil
    }
}
