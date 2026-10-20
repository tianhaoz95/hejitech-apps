import Foundation

/// One answer from Ask Voxbrief.
struct AskAnswer: Sendable, Equatable {
    struct Citation: Sendable, Equatable, Identifiable {
        let noteId: UUID
        let noteTitle: String
        let startTime: TimeInterval?
        var id: String { "\(noteId)-\(startTime ?? -1)" }
    }

    /// One listed line under the answer: an open action item, a note from the asked-about days,
    /// or a quoted passage, each linking to its note.
    struct Point: Sendable, Equatable, Identifiable {
        let text: String
        /// A priority or a date, shown as a small badge.
        let detail: String?
        let citation: Citation
        var id: String { "\(citation.id)|\(text)" }
    }

    enum Kind: Sendable, Equatable {
        /// The model's answer, citing the passages it used.
        case answered
        /// Built straight from the notes, no model call: open action items, or the notes
        /// recorded in the asked-about days. Exact, and what Lite answers worst.
        case listed
        /// The model gave nothing usable; the passages that mention the question, quoted.
        case excerpts
        case notFound
    }

    let kind: Kind
    let text: String
    let points: [Point]
    let citations: [Citation]
    /// What the passages were found with, shown under the question.
    let keywords: [String]
    /// The engine label (`CleanupEngineLabel`) that wrote the answer; nil when no model did.
    let engine: String?
    let notesSearched: Int

    var notFound: Bool { kind == .notFound }
}

enum AskError: LocalizedError {
    case noEngine

    var errorDescription: String? {
        switch self {
        case .noEngine:
            return "The on-device model couldn't run right now. Try again in a moment."
        }
    }
}

/// Ask Voxbrief: answers a question from the user's own notes, on the device, with the same
/// engine that writes the notes (`LLMCopywriterService.onDeviceEngines`). Two short calls around
/// a keyword search:
///
/// 1. The question becomes search keywords (with synonyms, since keyword search can't match
///    "money" to "budget" by itself) and an optional look-back in days ("last week" -> 7).
/// 2. `NoteSearchIndex` ranks passages; the best few, capped at `maxContextWords` so the prompt
///    fits Apple Intelligence's 4,096-token context, are numbered and the model answers from them
///    as JSON naming the passages it used. Our code turns those numbers into citations.
@MainActor
final class AskService {
    static let shared = AskService()

    /// ~2,100 tokens of passages: with the prompt and a 400-token answer, under 4,096.
    static let maxContextWords = 1_500
    static let maxPassages = 8

    private let repository: NoteRepository
    private let copywriter: LLMCopywriterService

    init(repository: NoteRepository = .shared, copywriter: LLMCopywriterService = .shared) {
        self.repository = repository
        self.copywriter = copywriter
    }

    func ask(_ question: String, now: Date = Date()) async throws -> AskAnswer {
        if let direct = Self.directAnswer(question, notes: repository.notes, now: now) {
            return direct
        }
        let engines = await copywriter.onDeviceEngines()
        var lastError: Error = AskError.noEngine
        for engine in engines {
            do {
                return try await ask(question, engine: engine, notes: repository.notes, now: now)
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                print("[AskService] \(engine.label) failed, trying the next engine: \(error)")
                lastError = error
            }
        }
        throw lastError
    }

    /// The whole flow against one engine and a snapshot of notes. `internal` for tests, which
    /// pass a scripted engine.
    func ask(_ question: String, engine: LLMCopywriterService.StageTwoEngine, notes: [VoiceNote], now: Date) async throws -> AskAnswer {
        if let direct = Self.directAnswer(question, notes: notes, now: now) {
            return direct
        }
        let query = await keywords(for: question, engine: engine)
        let index = NoteSearchIndex(notes: notes)
        let since = query.days.map { now.addingTimeInterval(-Double($0) * 86_400) }
        let hits = Self.trimmed(index.search(query.keywords + [question], since: since, limit: Self.maxPassages))
        let notesSearched = Set(index.passages.map(\.noteId)).count

        func notFound() -> AskAnswer {
            AskAnswer(
                kind: .notFound, text: "I couldn't find anything about that in your notes.",
                points: [], citations: [], keywords: query.keywords, engine: engine.label,
                notesSearched: notesSearched
            )
        }
        guard !hits.isEmpty else { return notFound() }

        let raw = try await engine.generate(Self.answerSystemPrompt(now: now), Self.answerUserPrompt(question: question, hits: hits), 400)
        let parsed = Self.parseAnswer(raw)

        guard !parsed.notFound, !Self.isUnusable(parsed.answer, question: question, hits: hits) else {
            // Lite often answers "No answer" (or just "found") when the passages do hold it, so
            // the passages that mention the question's own words are quoted instead.
            let points = Self.excerpts(for: question, hits: hits)
            guard !points.isEmpty else { return notFound() }
            return AskAnswer(
                kind: .excerpts, text: "I couldn't put together an answer, but these parts of your notes mention it:",
                points: points, citations: [], keywords: query.keywords, engine: nil,
                notesSearched: notesSearched
            )
        }

        let used = parsed.sources.compactMap { number in hits.indices.contains(number - 1) ? hits[number - 1] : nil }
        var seen: Set<String> = []
        let citations = (used.isEmpty ? Array(hits.prefix(1)) : used).compactMap { hit -> AskAnswer.Citation? in
            let citation = Self.citation(for: hit.passage)
            return seen.insert(citation.id).inserted ? citation : nil
        }
        return AskAnswer(
            kind: .answered, text: parsed.answer, points: [], citations: citations,
            keywords: query.keywords, engine: engine.label, notesSearched: notesSearched
        )
    }

    private static func citation(for passage: NoteSearchIndex.Passage) -> AskAnswer.Citation {
        AskAnswer.Citation(noteId: passage.noteId, noteTitle: passage.noteTitle, startTime: passage.startTime)
    }

    // MARK: - Answers built from the notes

    /// The days a question asks about ("yesterday", "last week", "past 3 days").
    struct TimeRange: Equatable {
        let start: Date
        let end: Date
        /// Reads after "recorded": "yesterday", "in the last 7 days".
        let label: String
    }

    static func timeRange(in question: String, now: Date, calendar: Calendar = .current) -> TimeRange? {
        let text = question.lowercased()
        let today = calendar.startOfDay(for: now)
        if text.contains("today") {
            return TimeRange(start: today, end: now, label: "today")
        }
        if text.contains("yesterday") {
            return TimeRange(start: today.addingTimeInterval(-86_400), end: today, label: "yesterday")
        }
        if let match = text.firstMatch(of: /(?:last|past)\s+(\d{1,3})\s+days?/), let days = Int(match.1), days > 0 {
            return TimeRange(start: now.addingTimeInterval(-Double(days) * 86_400), end: now, label: "in the last \(days) day\(days == 1 ? "" : "s")")
        }
        if text.contains(/(?:this|last|past)\s+week/) {
            return TimeRange(start: now.addingTimeInterval(-7 * 86_400), end: now, label: "in the last 7 days")
        }
        if text.contains(/(?:this|last|past)\s+month/) {
            return TimeRange(start: now.addingTimeInterval(-30 * 86_400), end: now, label: "in the last 30 days")
        }
        return nil
    }

    /// Words that only say "my notes" or "when", stemmed like `NoteSearchIndex.terms`. A question
    /// made of nothing else asks for a listing, not a search.
    static let listingWords: Set<String> = [
        "record", "recorded", "say", "talk", "talked", "idea", "thought", "think", "thinking",
        "mention", "mentioned", "capture", "captured", "today", "yesterday", "week", "month",
        "last", "past", "day", "recent", "recently", "lately", "new", "latest", "summary",
        "summarize", "recap", "happen", "happened", "discuss", "discussed", "cover", "covered",
        "go", "went", "over", "make", "made", "list", "show", "everything", "anything",
    ].reduce(into: Set<String>()) { $0.formUnion(NoteSearchIndex.terms(in: $1)) }

    static let actionWords: Set<String> = [
        "action", "item", "items", "todo", "todos", "task", "tasks", "open", "pending", "outstanding",
        "left", "remaining", "high", "priority", "urgent", "important", "follow", "up", "due", "list",
    ].reduce(into: Set<String>()) { $0.formUnion(NoteSearchIndex.terms(in: $1)) }

    /// Open action items, or the notes from the asked-about days, answered from the notes
    /// themselves. Nil for anything about a topic, which goes to search and the model.
    static func directAnswer(_ question: String, notes: [VoiceNote], now: Date) -> AskAnswer? {
        let lowered = question.lowercased()
        let range = timeRange(in: question, now: now)
        let terms = Set(NoteSearchIndex.terms(in: question))
        let asksForActions = ["action item", "to-do", "todo", "to do", "task", "open item"].contains { lowered.contains($0) }
        let visible = notes.filter { !$0.isArchived && !$0.isLocked && $0.status == .ready }

        if asksForActions, terms.subtracting(actionWords).subtracting(listingWords).isEmpty {
            var items = DailyBrief.build(notes: visible, since: .distantPast).openItems
            if let range { items = items.filter { $0.noteDate >= range.start && $0.noteDate < range.end } }
            let onlyHigh = ["high priority", "urgent", "important"].contains { lowered.contains($0) }
            if onlyHigh { items = items.filter { $0.priority == "high" } }
            let scope = range.map { " from notes recorded \($0.label)" } ?? ""
            let kindLabel = onlyHigh ? "high-priority action item" : "open action item"
            let text: String
            if items.isEmpty {
                text = "You have no \(kindLabel)s\(scope)."
            } else {
                let high = items.filter { $0.priority == "high" }.count
                let highNote = !onlyHigh && high > 0 ? ", \(high) of them high priority" : ""
                text = "You have \(items.count) \(kindLabel)\(items.count == 1 ? "" : "s")\(scope)\(highNote)."
            }
            let points = items.prefix(maxListed).map { item in
                AskAnswer.Point(
                    text: item.text, detail: item.priority?.capitalized,
                    citation: AskAnswer.Citation(noteId: item.noteId, noteTitle: item.noteTitle, startTime: nil)
                )
            }
            return listed(text + (items.count > maxListed ? " Here are the first \(maxListed)." : ""), points: Array(points))
        }

        guard terms.subtracting(listingWords).isEmpty, range != nil || !terms.isEmpty else { return nil }
        let inRange = visible
            .filter { note in range.map { note.createdAt >= $0.start && note.createdAt < $0.end } ?? true }
            .sorted { $0.createdAt > $1.createdAt }
        let shown = range == nil ? Array(inRange.prefix(5)) : Array(inRange.prefix(maxListed))
        let text: String
        if shown.isEmpty {
            let latest = visible.map(\.createdAt).max()
            let latestNote = latest.map { " Your latest note is from \($0.formatted(date: .abbreviated, time: .omitted))." } ?? ""
            text = "You didn't record any notes \(range?.label ?? "yet").\(latestNote)"
        } else if let range {
            text = "You recorded \(inRange.count) note\(inRange.count == 1 ? "" : "s") \(range.label)" + (inRange.count > shown.count ? ". Here are the latest \(shown.count):" : ":")
        } else {
            text = "Your \(shown.count == 1 ? "latest note" : "latest \(shown.count) notes"):"
        }
        let points = shown.map { note in
            AskAnswer.Point(
                text: note.summary.isEmpty ? String(note.rawTranscript.prefix(140)) : note.summary,
                detail: note.createdAt.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()),
                citation: AskAnswer.Citation(noteId: note.id, noteTitle: note.title, startTime: nil)
            )
        }
        return listed(text, points: points)
    }

    static let maxListed = 10

    private static func listed(_ text: String, points: [AskAnswer.Point]) -> AskAnswer {
        AskAnswer(kind: .listed, text: text, points: points, citations: [], keywords: [], engine: nil, notesSearched: 0)
    }

    // MARK: - Step 1: keywords

    struct Query: Equatable {
        let keywords: [String]
        let days: Int?
    }

    private struct KeywordsJSON: Decodable {
        var keywords: [String]?
        var days: Int?
    }

    private func keywords(for question: String, engine: LLMCopywriterService.StageTwoEngine) async -> Query {
        let fallback = Query(keywords: Self.contentWords(question), days: nil)
        guard let raw = try? await engine.generate(Self.keywordsSystemPrompt, question, 96) else { return fallback }
        return Self.parseKeywords(raw) ?? fallback
    }

    static let keywordsSystemPrompt = """
    You turn a question about the user's own voice notes into search keywords. Include the \
    important words of the question, names exactly as written, and two or three synonyms or \
    related words someone might have said instead (for "money": budget, cost, price). If the \
    question limits time ("last week", "yesterday", "this month"), give how many days back to \
    look. Respond with ONLY one valid JSON object -- no markdown code fences, no commentary -- \
    using exactly these keys: "keywords" (array of 3 to 10 short strings), "days" (integer, or \
    null when the question doesn't limit time).
    """

    static func parseKeywords(_ raw: String) -> Query? {
        guard let json = LLMCopywriterService.jsonObjectSubstring(in: raw),
              let decoded = try? JSONDecoder().decode(KeywordsJSON.self, from: Data(json.utf8)) else { return nil }
        let keywords = (decoded.keywords ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !keywords.isEmpty else { return nil }
        let days = decoded.days.flatMap { $0 > 0 && $0 <= 3_650 ? $0 : nil }
        return Query(keywords: Array(keywords.prefix(12)), days: days)
    }

    static func contentWords(_ text: String) -> [String] {
        text.split { !$0.isLetter && !$0.isNumber }
            .map(String.init)
            .filter { $0.count > 1 && !NoteSearchIndex.stopWords.contains($0.lowercased()) }
    }

    // MARK: - Step 2: answer

    /// Best hits first, stopping before the passages pass `maxContextWords`.
    static func trimmed(_ hits: [NoteSearchIndex.Hit]) -> [NoteSearchIndex.Hit] {
        var words = 0
        var result: [NoteSearchIndex.Hit] = []
        for hit in hits {
            let count = hit.passage.text.split(whereSeparator: \.isWhitespace).count
            if !result.isEmpty && words + count > maxContextWords { break }
            words += count
            result.append(hit)
        }
        return result
    }

    static func answerSystemPrompt(now: Date) -> String {
        let today = now.formatted(date: .complete, time: .omitted)
        return """
        You answer a question using only the numbered passages below, which come from the user's \
        own voice notes. Today is \(today). Speak to the user as "you" ("You told Priya..."). Be \
        brief: one to four sentences, with specifics (names, dates, amounts) taken from the \
        passages. If the passages don't contain the answer, say so instead of guessing. Respond \
        with ONLY one valid JSON object -- no markdown code fences, no commentary -- using exactly \
        these keys: "answer" (string), "sources" (array of the passage numbers you used), \
        "found" (true if the passages answer the question, false if not).
        """
    }

    static func answerUserPrompt(question: String, hits: [NoteSearchIndex.Hit]) -> String {
        let passages = hits.enumerated().map { index, hit -> String in
            let date = hit.passage.noteDate.formatted(date: .abbreviated, time: .omitted)
            let section: String
            switch hit.passage.kind {
            case .overview: section = "summary"
            case .section(let title): section = title
            case .transcript: section = "transcript"
            }
            return "[\(index + 1)] Note \"\(hit.passage.noteTitle)\" (\(date), \(section)): \(hit.passage.text)"
        }.joined(separator: "\n\n")
        return "Passages:\n\(passages)\n\nQuestion: \(question)"
    }

    struct ParsedAnswer: Equatable {
        let answer: String
        let sources: [Int]
        let notFound: Bool
    }

    /// Lenient, because the small models bend the format: fenced or cut-off JSON, `found` as a
    /// string, sources as strings, the answer as a list, citations written inline as "[2]". JSON
    /// that can't be read is never shown as the answer.
    static func parseAnswer(_ raw: String) -> ParsedAnswer {
        let cleaned = raw
            .replacing(/<think>[\s\S]*?<\/think>/, with: "")
            .replacingOccurrences(of: "<think>", with: "")
            .replacingOccurrences(of: "</think>", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if let json = LLMCopywriterService.jsonObjectSubstring(in: cleaned),
           let object = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] {
            let answer = text(from: object["answer"] ?? object["response"] ?? object["text"])
            let (body, inline) = strippingInlineCitations(answer)
            return ParsedAnswer(
                answer: body,
                sources: numbers(from: object["sources"] ?? object["source"]) + inline,
                notFound: flag(from: object["found"]) == false
            )
        }
        // An answer cut off by the token limit: keep the readable part of "answer".
        if let match = cleaned.firstMatch(of: /"answer"\s*:\s*"((?:[^"\\]|\\.)*)/) {
            let (body, inline) = strippingInlineCitations(String(match.1).replacingOccurrences(of: "\\\"", with: "\""))
            return ParsedAnswer(answer: body, sources: inline, notFound: false)
        }
        if cleaned.hasPrefix("{") || cleaned.hasPrefix("[") || cleaned.hasPrefix("`") {
            return ParsedAnswer(answer: "", sources: [], notFound: false)
        }
        let (body, inline) = strippingInlineCitations(cleaned)
        return ParsedAnswer(answer: body, sources: inline, notFound: false)
    }

    private static func text(from value: Any?) -> String {
        switch value {
        case let string as String:
            return string.trimmingCharacters(in: .whitespacesAndNewlines)
        case let list as [Any]:
            return list.compactMap { $0 as? String }.map { "• \($0)" }.joined(separator: "\n")
        default:
            return ""
        }
    }

    private static func numbers(from value: Any?) -> [Int] {
        switch value {
        case let list as [Any]:
            return list.flatMap { numbers(from: $0) }
        case let number as NSNumber:
            return CFGetTypeID(number) == CFBooleanGetTypeID() ? [] : [number.intValue]
        case let string as String:
            return string.matches(of: /\d+/).compactMap { Int($0.output) }
        default:
            return []
        }
    }

    private static func flag(from value: Any?) -> Bool? {
        switch value {
        case let number as NSNumber:
            return number.boolValue
        case let string as String:
            switch string.lowercased().trimmingCharacters(in: .whitespaces) {
            case "true", "yes": return true
            case "false", "no": return false
            default: return nil
            }
        default:
            return nil
        }
    }

    /// "…by Wednesday [1]." / "(Source 2)" become sources, and leave the text.
    static func strippingInlineCitations(_ text: String) -> (String, [Int]) {
        var sources: [Int] = []
        var body = text
        for match in text.matches(of: /\s*(?:\[(\d+(?:\s*,\s*\d+)*)\]|\((?:[Ss]ources?|[Pp]assages?)\s*(\d+)\))/) {
            let numbers = String(match.1 ?? match.2 ?? "")
            sources += numbers.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        }
        body = body.replacing(/\s*(?:\[\d+(?:\s*,\s*\d+)*\]|\((?:[Ss]ources?|[Pp]assages?)\s*\d+\))/, with: "")
        return (body.trimmingCharacters(in: .whitespacesAndNewlines), sources)
    }

    /// Replies the small models give in place of an answer.
    static let placeholderAnswers: Set<String> = [
        "", "found", "not found", "true", "false", "yes", "no", "none", "null", "nil", "n a",
        "unknown", "answer", "no answer", "no answer found", "no answer provided", "no information",
        "not mentioned", "no action items", "no ideas", "no passage related to the question",
    ]

    static func isUnusable(_ answer: String, question: String, hits: [NoteSearchIndex.Hit]) -> Bool {
        let normalized = answer.lowercased()
            .map { $0.isLetter || $0.isNumber ? $0 : " " }
            .reduce(into: "") { $0.append($1) }
            .split(separator: " ").joined(separator: " ")
        if placeholderAnswers.contains(normalized) || normalized.hasPrefix("no answer") { return true }
        let questionWords = question.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).joined(separator: " ")
        if normalized == questionWords { return true }
        // The prompt's own example, copied back.
        if normalized.contains("you told priya"), !hits.contains(where: { $0.passage.text.lowercased().contains("priya") }) { return true }
        return false
    }

    /// Up to four passages that contain the question's own topic words, each cut to a short
    /// quote around the first match.
    static func excerpts(for question: String, hits: [NoteSearchIndex.Hit]) -> [AskAnswer.Point] {
        let topic = Set(NoteSearchIndex.terms(in: question)).subtracting(listingWords)
        guard !topic.isEmpty else { return [] }
        var points: [AskAnswer.Point] = []
        for hit in hits {
            let words = hit.passage.text.split(whereSeparator: \.isWhitespace).map(String.init)
            guard let first = words.firstIndex(where: { word in NoteSearchIndex.terms(in: word).contains(where: topic.contains) }) else { continue }
            let start = max(0, first - 8)
            let end = min(words.count, start + 30)
            let quote = (start > 0 ? "…" : "") + words[start..<end].joined(separator: " ") + (end < words.count ? "…" : "")
            points.append(AskAnswer.Point(
                text: quote,
                detail: hit.passage.noteDate.formatted(.dateTime.month(.abbreviated).day()),
                citation: citation(for: hit.passage)
            ))
            if points.count == 4 { break }
        }
        return points
    }
}
