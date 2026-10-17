import ContempoCore
import Foundation

/// The last-resort parse when no on-device model can run: plain pattern matching for duration,
/// miles, a known property name and the category, so a capture still becomes a usable draft
/// instead of an empty form. Same role as Voxbrief's rule-based transformer; mirrors Android's
/// `RuleBasedEntryParser`.
enum RuleBasedEntryParser {
    static func parse(rawText: String, knownProperties: [String]) -> EntryDraft? {
        var text = rawText.replacingOccurrences(of: #"\b(um+|uh+|erm|like,|you know,)\s*"#, with: "", options: [.regularExpression, .caseInsensitive])
        text = text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        let lower = text.lowercased()
        var minutes = 0.0
        if let h = firstNumber(#"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b"#, in: text) { minutes += h * 60 }
        if let m = firstNumber(#"(\d+)\s*(?:minutes?|mins?|m)\b"#, in: text) { minutes += m }
        if minutes == 0 {
            if lower.contains("half an hour") { minutes = 30 }
            else if lower.range(of: #"\ban hour\b|\bone hour\b"#, options: .regularExpression) != nil { minutes = 60 }
        }
        return EntryDraft(
            property: knownProperties.first { !$0.isEmpty && lower.contains($0.lowercased()) },
            task: text.prefix(1).uppercased() + text.dropFirst(),
            durationMinutes: minutes > 0 ? Int(minutes) : nil,
            category: CategoryClassifier.classify(text)?.firestoreValue,
            eventType: nil,
            miles: firstNumber(#"(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:miles?|mi)\b"#, in: text),
            resolvedActivityDateIso: nil
        )
    }

    private static let validCategories: Set<String> = ["maintenance", "turnover", "guest_communication", "supply_run", "admin", "other"]

    /// Checks a small model's draft against what can be read deterministically, the Voxbrief way
    /// (the bundled 0.6B model's fields aren't trusted on their own): a stated duration/distance and
    /// a known property named in the text win; the property must be one of the host's; the timer
    /// intent comes from `TimerIntentClassifier`; time references are dropped.
    static func refineSmallModelDraft(_ model: EntryDraft, rawText: String, knownProperties: [String]) -> EntryDraft {
        let rules = parse(rawText: rawText, knownProperties: knownProperties)
        let modelProperty = model.property.flatMap { p in knownProperties.first { $0.caseInsensitiveCompare(p.trimmingCharacters(in: .whitespaces)) == .orderedSame } }
        let event: String? = switch TimerIntentClassifier.classify(rawText) {
        case .start: "start"
        case .stop: "stop"
        case nil: nil
        }
        return EntryDraft(
            property: rules?.property ?? modelProperty,
            task: (model.task?.isEmpty == false ? model.task : nil) ?? rules?.task,
            durationMinutes: rules?.durationMinutes ?? model.durationMinutes,
            category: model.category.flatMap { validCategories.contains($0) ? $0 : nil } ?? rules?.category,
            eventType: event,
            miles: rules?.miles ?? model.miles.flatMap { $0 > 0 ? $0 : nil },
            resolvedActivityDateIso: nil
        )
    }

    private static func firstNumber(_ pattern: String, in text: String) -> Double? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else { return nil }
        return Double(text[range])
    }
}
