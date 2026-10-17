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
        let numeric = spokenNumbersAsDigits(lower)
        var minutes = 0.0
        if let h = firstNumber(#"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b"#, in: numeric) { minutes += h * 60 }
        if let m = firstNumber(#"(\d+)\s*(?:minutes?|mins?|m)\b"#, in: numeric) { minutes += m }
        if minutes == 0, numeric.range(of: #"\ban hour\b"#, options: .regularExpression) != nil { minutes = 60 }
        return EntryDraft(
            property: knownProperties.first { !$0.isEmpty && lower.contains($0.lowercased()) },
            task: text.prefix(1).uppercased() + text.dropFirst(),
            durationMinutes: minutes > 0 ? Int(minutes) : nil,
            category: CategoryClassifier.classify(text)?.firestoreValue,
            eventType: nil,
            miles: firstNumber(#"(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:miles?|mi)\b"#, in: numeric),
            resolvedActivityDateIso: nil
        )
    }

    private static let validCategories: Set<String> = ["maintenance", "turnover", "guest_communication", "supply_run", "admin", "other"]

    /// Checks a small model's draft against what can be read deterministically, the Voxbrief way
    /// (the bundled 0.6B model's fields aren't trusted on their own): a stated duration/distance and
    /// a known property named in the text win; the property must be one of the host's; the timer
    /// intent comes from `TimerIntentClassifier`; time references are dropped.
    /// The small model sometimes answers with one stray word ("start"): keep its task only if it's a phrase drawn from the capture.
    private static func plausibleTask(_ task: String, rawText: String) -> Bool {
        func words(_ s: String) -> [String] {
            s.lowercased().components(separatedBy: CharacterSet.lowercaseLetters.inverted).filter { $0.count >= 3 }
        }
        if task.contains("_") || !task.trimmingCharacters(in: .whitespaces).contains(" ") { return false }
        let taskWords = words(task)
        let said = Set(words(rawText))
        return taskWords.count >= 2 && taskWords.filter(said.contains).count * 2 >= taskWords.count
    }

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
            task: model.task.flatMap { plausibleTask($0, rawText: rawText) ? $0 : nil } ?? rules?.task,
            durationMinutes: rules?.durationMinutes ?? model.durationMinutes,
            category: model.category.flatMap { validCategories.contains($0) ? $0 : nil } ?? rules?.category,
            eventType: event,
            miles: rules?.miles ?? model.miles.flatMap { $0 > 0 ? $0 : nil },
            resolvedActivityDateIso: nil
        )
    }

    private static let units = [
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
        "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    ]
    private static let tens = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

    /// Spoken numbers as digits, for matching durations and distances only (the task keeps the
    /// words): "two hours" → "2 hours", "forty-five minutes" → "45 minutes", "an hour and a half"
    /// → "1.5 hours". Whisper transcribes small numbers as words. Mirrors Android.
    static func spokenNumbersAsDigits(_ lower: String) -> String {
        var t = replacing(#"\b(\#(tens.joined(separator: "|")))(?:[\s-](\#(units.prefix(9).joined(separator: "|"))))?\b"#, in: lower) { groups in
            let n = ((tens.firstIndex(of: groups[1]) ?? 0) + 2) * 10 + (groups[2].isEmpty ? 0 : (units.firstIndex(of: groups[2]) ?? -1) + 1)
            return String(n)
        }
        t = replacing(#"\b(\#(units.joined(separator: "|")))\b"#, in: t) { groups in String((units.firstIndex(of: groups[1]) ?? 0) + 1) }
        t = t.replacingOccurrences(of: #"\ba couple(?: of)?\b"#, with: "2", options: .regularExpression)
            .replacingOccurrences(of: #"\b(?:an?|1) (hour|mile) and a half\b"#, with: "1.5 $1s", options: .regularExpression)
            .replacingOccurrences(of: #"\b(\d+) and a half (hours?|miles?)\b"#, with: "$1.5 $2", options: .regularExpression)
            .replacingOccurrences(of: #"\b(?:a )?half (?:an )?hour\b"#, with: "30 minutes", options: .regularExpression)
        return t
    }

    private static func replacing(_ pattern: String, in text: String, with transform: ([String]) -> String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return text }
        var result = ""
        var rest = text.startIndex
        for match in regex.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let whole = Range(match.range, in: text) else { continue }
            let groups = (0..<match.numberOfRanges).map { i in Range(match.range(at: i), in: text).map { String(text[$0]) } ?? "" }
            result += text[rest..<whole.lowerBound] + transform(groups)
            rest = whole.upperBound
        }
        return result + text[rest...]
    }

    private static func firstNumber(_ pattern: String, in text: String) -> Double? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else { return nil }
        return Double(text[range])
    }
}
