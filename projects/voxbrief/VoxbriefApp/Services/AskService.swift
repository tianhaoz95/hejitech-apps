import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// One answer from Ask Voxbrief: what the model said, the searches it ran to get there, and the
/// passages it cited.
struct AskAnswer: Sendable, Equatable {
    struct Citation: Sendable, Equatable, Identifiable {
        let noteId: UUID
        let noteTitle: String
        let startTime: TimeInterval?
        var id: String { "\(noteId)-\(startTime ?? -1)" }
    }

    /// A `search_notes` call the model made for this answer.
    struct Search: Sendable, Equatable {
        let query: String
        let daysBack: Int?
        let resultCount: Int
    }

    let text: String
    let citations: [Citation]
    let searches: [Search]
    /// The engine label (`CleanupEngineLabel`) that answered.
    let engine: String
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

/// A turn of an Ask conversation as an MLX model sees it (Qwen3's chat roles; a `tool` turn is
/// a search's results).
struct AskMessage: Sendable, Equatable {
    enum Role: String, Sendable { case system, user, assistant, tool }
    let role: Role
    let content: String
    /// A question sent with an attached note: the question alone, which is what older turns
    /// keep (`AskConversation.trimmed`), so an attachment doesn't stay in the prompt for good.
    var question: String? = nil
}

/// A model that continues a chat with tools: given the conversation and the tool specs, it
/// returns its raw reply (Qwen3 writes a tool call as `<tool_call>{json}</tool_call>`).
/// `prefill` is the start of the reply, already written for it (it's part of the reply returned).
struct AskEngine: Sendable {
    let label: String
    /// Small models that don't call tools by themselves (Lite: 0 of 10 questions in the
    /// prototype) have each question's first reply started as a search call, which they then
    /// write themselves (query and days).
    var startsWithSearch = false
    let respond: @Sendable (_ messages: [AskMessage], _ tools: [[String: any Sendable]], _ prefill: String, _ maxTokens: Int) async throws -> String
}

/// Ask Voxbrief: a chat about the user's own notes, answered by the on-device model, which
/// finds what the notes say with tools: `search_notes` (keyword search over the notes,
/// `NoteSearchIndex`), and for Flash and Apple Intelligence also `notes_on_dates` (the notes of
/// a day or a period) and `open_todos` (to-dos not checked off yet). Lite keeps the search tool
/// alone (it doesn't pick tools by itself). The model decides what to look up, can look again,
/// and answers from the passages it read, citing them as [n].
///
/// One conversation per Ask sheet: follow-up questions see the earlier turns. Apple
/// Intelligence runs it with FoundationModels' own tool calling (one session per
/// conversation); Lite and Flash with Qwen3's native tool format through MLX.
@MainActor
final class AskConversation {
    static let maxPassagesPerSearch = 6
    static let maxResultWords = 900
    /// Model calls per question: up to three searches and the answer.
    static let maxSteps = 4
    /// Earlier questions whose search results stay in the prompt (older ones keep only the
    /// question and answer), so a long chat doesn't outgrow the context or slow down.
    static let questionsWithResults = 2

    private let notes: @MainActor () -> [VoiceNote]
    private let engines: () async -> [AskEngine]
    private let appleSessionAvailable: () async -> Bool
    private let now: () -> Date

    /// Every passage any search returned in this conversation, numbered from 1 in that order,
    /// so a citation [n] means the same passage all conversation long.
    private(set) var passages: [NoteSearchIndex.Passage] = []
    /// The MLX conversation, without its system prompt.
    private(set) var history: [AskMessage] = []
    private var searchesThisQuestion: [AskAnswer.Search] = []
    private var appleSession: AnyObject?

    init(
        notes: (@MainActor () -> [VoiceNote])? = nil,
        engines: (() async -> [AskEngine])? = nil,
        appleSessionAvailable: (() async -> Bool)? = nil,
        now: @escaping () -> Date = Date.init
    ) {
        self.notes = notes ?? { NoteRepository.shared.notes }
        self.engines = engines ?? { await AskConversation.mlxEngines() }
        self.appleSessionAvailable = appleSessionAvailable ?? { await OnDeviceLLMService.shared.isUsingAppleFoundationModel }
        self.now = now
    }

    /// `attached`: a note the user picked as context for this question (the Ask sheet's
    /// paperclip). Its passages go in with the question, numbered like search results, so the
    /// answer can cite them.
    func ask(_ question: String, attached: VoiceNote? = nil) async throws -> AskAnswer {
        searchesThisQuestion = []
        let context = attached.map(attachedContext)
        if await appleSessionAvailable() {
            do {
                return try await askApple(question, context: context)
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                print("[Ask] Apple Intelligence failed, trying MLX: \(error)")
            }
        }
        var lastError: Error = AskError.noEngine
        for engine in await engines() {
            do {
                return try await ask(question, engine: engine, context: context)
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                print("[Ask] \(engine.label) failed: \(error)")
                lastError = error
            }
        }
        throw lastError
    }

    // MARK: - MLX (Qwen3 tool format)

    static func mlxEngines() async -> [AskEngine] {
        let service = OnDeviceLLMService.shared
        let large = await service.isUsingLargeModel
        return [AskEngine(
            label: CleanupEngineLabel.onDeviceLLM(model: await service.mlxModelDisplayName),
            startsWithSearch: !large
        ) { messages, tools, prefill, maxTokens in
            try await service.chat(
                messages: messages.map { ($0.role.rawValue, $0.content) },
                tools: tools, prefill: prefill, maxTokens: maxTokens
            )
        }]
    }

    static let searchCallPrefill = "<tool_call>\n{\"name\": \"search_notes\", \"arguments\": "

    /// The whole loop against one engine. `internal` for tests, which pass a scripted engine.
    /// `context` is an attached note's passages (`attachedContext`): the model has read them,
    /// so it isn't made to search first, and the question isn't checked for small talk.
    func ask(_ question: String, engine: AskEngine, context: String? = nil) async throws -> AskAnswer {
        searchesThisQuestion = []
        var turn: [AskMessage] = [
            context.map { AskMessage(role: .user, content: Self.withContext($0, question), question: question) }
                ?? AskMessage(role: .user, content: question)
        ]
        var searched = context != nil

        // Lite would otherwise search for "Hi" too (every first reply is a search): small talk
        // gets a short reply instead.
        if context == nil, engine.startsWithSearch, try await Self.isSmallTalk(question, engine: engine) {
            return try await chat(turn, engine: engine)
        }

        for step in 0..<Self.maxSteps {
            let last = step == Self.maxSteps - 1
            let messages = [AskMessage(role: .system, content: Self.systemPrompt(now: now(), allTools: !engine.startsWithSearch))]
                + Self.trimmed(history) + turn
            // A model that answers before it has read anything is made to search first.
            var prefill = !searched && step == 0 && engine.startsWithSearch ? Self.searchCallPrefill : ""
            let tools = Self.tools(for: engine)
            var reply = try await engine.respond(messages, last ? [] : tools, prefill, 400)
            if !last, !searched, passages.isEmpty, Self.toolCall(in: reply) == nil, prefill.isEmpty {
                // An answer to small talk stands; any other answer before a search is redone as one.
                if try await Self.isSmallTalk(question, engine: engine) {
                    return keep(finish(reply, engine: engine.label), turn: turn)
                }
                prefill = Self.searchCallPrefill
                reply = try await engine.respond(messages, tools, prefill, 400)
            }
            if !last, let call = Self.toolCall(in: reply) {
                let result = run(call)
                turn.append(AskMessage(role: .assistant, content: Self.normalizedCall(call)))
                turn.append(AskMessage(role: .tool, content: result))
                searched = true
                continue
            }
            let answer = finish(reply, engine: engine.label)
            turn.append(AskMessage(role: .assistant, content: answer.text))
            history += turn
            return answer
        }
        // Only searches, no answer.
        let answer = finish("", engine: engine.label)
        history += turn + [AskMessage(role: .assistant, content: answer.text)]
        return answer
    }

    /// A reply to small talk: the conversation's questions and answers (no searches) and no tools.
    private func chat(_ turn: [AskMessage], engine: AskEngine) async throws -> AskAnswer {
        let said = history
            .filter { $0.role == .user || ($0.role == .assistant && Self.toolCall(in: $0.content) == nil) }
            .map(Self.withoutAttachment)
        let reply = try await engine.respond(
            [AskMessage(role: .system, content: Self.chatPrompt)] + said + turn, [], "", 200
        )
        return keep(finish(reply, engine: engine.label), turn: turn)
    }

    private func keep(_ answer: AskAnswer, turn: [AskMessage]) -> AskAnswer {
        history += turn + [AskMessage(role: .assistant, content: answer.text)]
        return answer
    }

    /// The conversation so far with only the last `questionsWithResults` questions' searches.
    static func trimmed(_ history: [AskMessage]) -> [AskMessage] {
        let questionStarts = history.indices.filter { history[$0].role == .user }
        guard questionStarts.count > questionsWithResults else { return history }
        let keepFrom = questionStarts[questionStarts.count - questionsWithResults]
        let older = history[..<keepFrom]
            .filter { $0.role == .user || ($0.role == .assistant && toolCall(in: $0.content) == nil) }
            .map(withoutAttachment)
        return older + history[keepFrom...]
    }

    static func withoutAttachment(_ message: AskMessage) -> AskMessage {
        message.question.map { AskMessage(role: message.role, content: $0) } ?? message
    }

    // MARK: - Attached notes

    /// Words of an attached note the model reads (Lite's context and speed are the limit); a
    /// longer note is cut, and the model is told it can search the rest.
    static let maxAttachedWords = 1_200

    /// An attached note as the model reads it: its passages (overview, template sections,
    /// transcript windows, as the search index cuts it), numbered after every passage so far.
    func attachedContext(_ note: VoiceNote) -> String {
        let all = NoteSearchIndex.makePassages(for: note)
        var words = 0
        var kept: [NoteSearchIndex.Passage] = []
        for passage in all {
            let count = passage.text.split(whereSeparator: \.isWhitespace).count
            if !kept.isEmpty && words + count > Self.maxAttachedWords { break }
            words += count
            kept.append(passage)
        }
        let first = passages.count + 1
        passages += kept
        let date = note.createdAt.formatted(date: .abbreviated, time: .omitted)
        var text = "The user attached their note \"\(note.title)\" (\(date)) to this question. Its passages:\n\n"
            + kept.enumerated().map { Self.render($1, number: first + $0) }.joined(separator: "\n\n")
        if kept.count < all.count {
            text += "\n\n(The note is longer; search_notes finds the rest.)"
        }
        return text
    }

    /// The question after its attached note, told to answer from the note.
    static func withContext(_ context: String, _ question: String) -> String {
        """
        \(context)

        Answer from these passages (search_notes only if they don't answer it), citing them like [2].
        Question: \(question)
        """
    }

    static func normalizedCall(_ call: ToolCall) -> String {
        var arguments: [String: Any] = [:]
        switch call.name {
        case Self.datesToolName:
            arguments["from"] = call.from ?? ""
            if let to = call.to { arguments["to"] = to }
        case Self.todosToolName:
            if let days = call.daysBack { arguments["days_back"] = days }
        default:
            arguments["query"] = call.query
            if let days = call.daysBack { arguments["days_back"] = days }
        }
        let object: [String: Any] = ["name": call.name, "arguments": arguments]
        let data = (try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])) ?? Data()
        return "<tool_call>\n\(String(decoding: data, as: UTF8.self))\n</tool_call>"
    }

    struct ToolCall: Equatable {
        var name: String = AskConversation.searchToolName
        let query: String
        let daysBack: Int?
        /// notes_on_dates: the first and last day, as the model wrote them (YYYY-MM-DD).
        var from: String? = nil
        var to: String? = nil
    }

    /// The first tool call in a reply, leniently: a missing closing tag (cut off), arguments as
    /// a JSON string, `days`/`days_back` as a string, 0 days as no limit. An unknown tool name
    /// is taken as a search (the only tool Lite has).
    static func toolCall(in reply: String) -> ToolCall? {
        guard let open = reply.range(of: "<tool_call>") else { return nil }
        let body = String(reply[open.upperBound...])
        guard let json = LLMCopywriterService.jsonObjectSubstring(in: body),
              let object = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] else { return nil }
        var arguments = object["arguments"] as? [String: Any]
        if arguments == nil, let string = object["arguments"] as? String,
           let decoded = (try? JSONSerialization.jsonObject(with: Data(string.utf8))) as? [String: Any] {
            arguments = decoded
        }
        let args = arguments ?? object
        let query = (args["query"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let rawDays = args["days_back"] ?? args["days"]
        let days = (rawDays as? Int) ?? (rawDays as? String).flatMap { Int($0) }
        let daysBack = days.flatMap { $0 > 0 && $0 <= 3_650 ? $0 : nil }
        switch object["name"] as? String {
        case Self.datesToolName?:
            let from = (args["from"] as? String ?? args["date"] as? String ?? "").trimmingCharacters(in: .whitespaces)
            let to = (args["to"] as? String)?.trimmingCharacters(in: .whitespaces)
            return ToolCall(name: Self.datesToolName, query: "", daysBack: nil, from: from, to: to?.isEmpty == true ? nil : to)
        case Self.todosToolName?:
            return ToolCall(name: Self.todosToolName, query: "", daysBack: daysBack)
        default:
            return ToolCall(query: query, daysBack: daysBack)
        }
    }

    // MARK: - Apple Intelligence (FoundationModels tools)

    private func askApple(_ question: String, context: String?) async throws -> AskAnswer {
        let prompt = context.map { Self.withContext($0, question) } ?? question
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            func newSession() -> LanguageModelSession {
                let search = SearchNotesTool { [weak self] query, days in
                    await MainActor.run { self?.search(query: query, daysBack: days) ?? "No notes matched." }
                }
                let dates = NotesOnDatesTool { [weak self] from, to in
                    await MainActor.run { self?.notesOnDates(from: from, to: to) ?? "No notes on those days." }
                }
                let todos = OpenTodosTool { [weak self] days in
                    await MainActor.run { self?.openTodos(daysBack: days) ?? "No open to-dos." }
                }
                return LanguageModelSession(tools: [search, dates, todos], instructions: Self.systemPrompt(now: now(), allTools: true))
            }
            let session = (appleSession as? LanguageModelSession) ?? newSession()
            appleSession = session
            do {
                let reply = try await session.respond(to: prompt).content
                return finish(reply, engine: CleanupEngineLabel.appleFoundationModel)
            } catch LanguageModelSession.GenerationError.exceededContextWindowSize(_) {
                // A long chat: start over with a fresh session (the passages stay numbered).
                let fresh = newSession()
                appleSession = fresh
                searchesThisQuestion = []
                let reply = try await fresh.respond(to: prompt).content
                return finish(reply, engine: CleanupEngineLabel.appleFoundationModel)
            }
        }
        #endif
        throw AppleFoundationModelError.unsupportedPlatform
    }

    // MARK: - The tools

    static let searchToolName = "search_notes"
    static let datesToolName = "notes_on_dates"
    static let todosToolName = "open_todos"

    /// Lite has the search tool alone (it never picks a tool itself: its first reply is started
    /// as a search); Flash and Apple Intelligence also get the dates and to-do tools.
    static func tools(for engine: AskEngine) -> [[String: any Sendable]] {
        engine.startsWithSearch ? [searchToolSpec] : [searchToolSpec, datesToolSpec, todosToolSpec]
    }

    /// Runs a tool call and returns what the model reads.
    func run(_ call: ToolCall) -> String {
        switch call.name {
        case Self.datesToolName: return notesOnDates(from: call.from ?? "", to: call.to)
        case Self.todosToolName: return openTodos(daysBack: call.daysBack)
        default: return search(query: call.query, daysBack: call.daysBack)
        }
    }

    static let datesToolDescription = "List the notes recorded on a day or between two days, each with its summary. Use it when the question is about when (\"what did I record on Monday\", \"my notes from last week\") rather than a topic."
    static let fromDescription = "The first day, as YYYY-MM-DD."
    static let toDescription = "The last day, as YYYY-MM-DD. Leave it out for a single day."
    static let todosToolDescription = "List the to-dos from the notes that aren't checked off yet, newest note first. Use it for questions about tasks, to-dos or what's left to do."

    static let datesToolSpec: [String: any Sendable] = [
        "type": "function",
        "function": [
            "name": datesToolName,
            "description": datesToolDescription,
            "parameters": [
                "type": "object",
                "properties": [
                    "from": ["type": "string", "description": fromDescription] as [String: any Sendable],
                    "to": ["type": "string", "description": toDescription] as [String: any Sendable],
                ] as [String: any Sendable],
                "required": ["from"],
            ] as [String: any Sendable],
        ] as [String: any Sendable],
    ]

    static let todosToolSpec: [String: any Sendable] = [
        "type": "function",
        "function": [
            "name": todosToolName,
            "description": todosToolDescription,
            "parameters": [
                "type": "object",
                "properties": [
                    "days_back": ["type": "integer", "description": "Only to-dos from notes of the last N days. Leave it out for all."] as [String: any Sendable],
                ] as [String: any Sendable],
            ] as [String: any Sendable],
        ] as [String: any Sendable],
    ]

    /// The notes a search can see: ready, not archived, not locked.
    private func visibleNotes() -> [VoiceNote] {
        notes().filter { !$0.isArchived && !$0.isLocked && $0.status == .ready }
    }

    /// A day the model wrote: YYYY-MM-DD (the format the tool asks for), or a few lenient forms.
    static func day(_ text: String, calendar: Calendar = .current) -> Date? {
        let t = text.trimmingCharacters(in: .whitespaces)
        for format in ["yyyy-MM-dd", "yyyy/MM/dd", "MMM d, yyyy", "MMMM d, yyyy"] {
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.calendar = calendar
            f.timeZone = calendar.timeZone
            f.dateFormat = format
            if let d = f.date(from: t) { return calendar.startOfDay(for: d) }
        }
        return nil
    }

    /// `notes_on_dates`: each note recorded in the days, as an overview passage (title, summary,
    /// open to-dos), oldest first, numbered for citing like search results.
    func notesOnDates(from: String, to: String?) -> String {
        let calendar = Calendar.current
        guard let start = Self.day(from, calendar: calendar) else {
            searchesThisQuestion.append(AskAnswer.Search(query: "dates \(from)", daysBack: nil, resultCount: 0))
            return "\"\(from)\" isn't a date. Pass days as YYYY-MM-DD."
        }
        var end = to.flatMap { Self.day($0, calendar: calendar) } ?? start
        if end < start { end = start }
        let until = calendar.date(byAdding: .day, value: 1, to: end) ?? end
        let found = visibleNotes()
            .filter { $0.createdAt >= start && $0.createdAt < until }
            .sorted { $0.createdAt < $1.createdAt }
            .compactMap { note in NoteSearchIndex.makePassages(for: note).first { $0.kind == .overview } }
        let capped = Self.cappedByWords(Array(found.prefix(Self.maxPassagesPerSearch * 2)))
        let span = to == nil || end == start ? from : "\(from) to \(to ?? from)"
        searchesThisQuestion.append(AskAnswer.Search(query: "notes \(span)", daysBack: nil, resultCount: capped.count))
        guard !capped.isEmpty else { return "No notes were recorded \(end == start ? "on" : "between") \(span)." }
        let first = passages.count + 1
        passages += capped
        var text = capped.enumerated().map { Self.render($1, number: first + $0) }.joined(separator: "\n\n")
        if capped.count < found.count { text += "\n\n(\(found.count - capped.count) more notes in those days; ask about a shorter span.)" }
        return text
    }

    /// `open_todos`: the to-dos not checked off yet, one passage per note, newest note first.
    func openTodos(daysBack: Int?) -> String {
        let since = daysBack.map { now().addingTimeInterval(-Double($0) * 86_400) }
        let withTodos = visibleNotes()
            .filter { note in since.map { note.createdAt >= $0 } ?? true }
            .sorted { $0.createdAt > $1.createdAt }
            .compactMap { note -> NoteSearchIndex.Passage? in
                let open = note.actionItems.filter { !note.completedActionItems.contains($0) }
                guard !open.isEmpty else { return nil }
                return NoteSearchIndex.Passage(
                    noteId: note.id, noteTitle: note.title, noteDate: note.createdAt, kind: .section("To-dos"),
                    text: "Open to-dos:\n" + open.map { "- \($0)" }.joined(separator: "\n"), startTime: nil
                )
            }
        let capped = Self.cappedByWords(Array(withTodos.prefix(Self.maxPassagesPerSearch * 2)))
        searchesThisQuestion.append(AskAnswer.Search(query: "open to-dos", daysBack: daysBack, resultCount: capped.count))
        guard !capped.isEmpty else {
            return daysBack.map { "No open to-dos in notes from the last \($0) days." } ?? "No open to-dos: everything in the notes is checked off, or no note has to-dos."
        }
        let first = passages.count + 1
        passages += capped
        return capped.enumerated().map { Self.render($1, number: first + $0) }.joined(separator: "\n\n")
    }

    // MARK: - The search tool

    static let searchToolDescription = "Search the user's voice notes by keywords. Returns numbered passages, each with its note's title and date. An empty query returns the most recent notes."
    /// No example words here: Lite copied the old example ("money") as its query for "Hi".
    static let queryDescription = "Words from the question to look for, plus a few synonyms."
    static let daysDescription = "Only when the question names a time (\"this week\": 7, \"yesterday\": 1). Leave it out otherwise."

    static let searchToolSpec: [String: any Sendable] = [
        "type": "function",
        "function": [
            "name": "search_notes",
            "description": searchToolDescription,
            "parameters": [
                "type": "object",
                "properties": [
                    "query": ["type": "string", "description": queryDescription] as [String: any Sendable],
                    "days_back": ["type": "integer", "description": daysDescription] as [String: any Sendable],
                ] as [String: any Sendable],
                "required": ["query"],
            ] as [String: any Sendable],
        ] as [String: any Sendable],
    ]

    /// Runs one search for the model and returns what it reads: numbered passages (numbers
    /// continue across the conversation). A time limit ranks newer notes first in a keyword
    /// search (models add limits the question didn't ask for); a query with no searchable words
    /// returns the latest notes in the limit, or older ones, saying so, when it has none.
    func search(query: String, daysBack: Int?) -> String {
        let current = now()
        let visible = notes().filter { !$0.isArchived && !$0.isLocked && $0.status == .ready }
        let index = NoteSearchIndex(notes: visible)
        let since = daysBack.map { current.addingTimeInterval(-Double($0) * 86_400) }
        let terms = NoteSearchIndex.terms(in: query)

        func run(since: Date?) -> [NoteSearchIndex.Passage] {
            if terms.isEmpty {
                return index.passages
                    .filter { passage in passage.kind == .overview && (since.map { passage.noteDate >= $0 } ?? true) }
                    .sorted { $0.noteDate > $1.noteDate }
                    .prefix(Self.maxPassagesPerSearch)
                    .map { $0 }
            }
            return index.search([query], since: since, limit: Self.maxPassagesPerSearch).map(\.passage)
        }

        var found = run(since: since)
        var header = ""
        if found.isEmpty, let daysBack {
            found = run(since: nil)
            if !found.isEmpty { header = "Nothing in the last \(daysBack) day\(daysBack == 1 ? "" : "s"). Older notes:\n" }
        }
        found = Self.cappedByWords(found)
        searchesThisQuestion.append(AskAnswer.Search(query: query, daysBack: daysBack, resultCount: found.count))
        guard !found.isEmpty else {
            return query.isEmpty ? "There are no notes yet." : "No notes matched \"\(query)\"."
        }
        let first = passages.count + 1
        passages += found
        return header + found.enumerated().map { offset, passage in
            Self.render(passage, number: first + offset)
        }.joined(separator: "\n\n")
    }

    static func cappedByWords(_ found: [NoteSearchIndex.Passage]) -> [NoteSearchIndex.Passage] {
        var words = 0
        var result: [NoteSearchIndex.Passage] = []
        for passage in found {
            let count = passage.text.split(whereSeparator: \.isWhitespace).count
            if !result.isEmpty && words + count > maxResultWords { break }
            words += count
            result.append(passage)
        }
        return result
    }

    /// "Passage 3, from "Title" (Nov 18, 2026):" and the text on its own line. Lite pasted the
    /// earlier one-line `[3] Note "Title" (date, transcript): text` into its answers (6 of 16
    /// right in the eval, 13 of 16 with this).
    static func render(_ passage: NoteSearchIndex.Passage, number: Int) -> String {
        let date = passage.noteDate.formatted(date: .abbreviated, time: .omitted)
        return "Passage \(number), from \"\(passage.noteTitle)\" (\(date)):\n\(passage.text)"
    }

    // MARK: - The answer

    /// `allTools`: Flash and Apple Intelligence, which also have `notes_on_dates` and
    /// `open_todos`; Lite's prompt (search only) is unchanged.
    static func systemPrompt(now: Date, allTools: Bool = false) -> String {
        let today = now.formatted(date: .complete, time: .omitted)
        if allTools {
            let iso = now.formatted(.iso8601.year().month().day())
            return """
            You are Voxbrief's assistant. You answer questions about the user's own voice notes. \
            Today is \(today) (\(iso)). You can't see the notes. For every new question, your first \
            reply must be a tool call: notes_on_dates when the question is about a day or a period \
            (work out the dates from today), open_todos when it's about tasks or what's left to do, \
            search_notes for anything else. Answer only after you've read the results, and look \
            again another way if they don't answer it. Then answer in one to four sentences, speaking \
            to the user as "you", with specifics (names, dates, amounts) from the passages, and cite \
            the passages you used like [2]. Answer in your own words: never copy a passage or its \
            heading. If the passages don't answer it, say you couldn't find it in the notes.
            """
        }
        return """
        You are Voxbrief's assistant. You answer questions about the user's own voice notes. \
        Today is \(today). You can't see the notes. For every new question, your first reply \
        must be a search_notes call; answer only after you've read its results, and search again \
        with other words if they don't answer it. Then answer in one to four sentences, speaking \
        to the user as "you", with specifics (names, dates, amounts) from the passages, and cite \
        the passages you used like [2]. Answer in your own words: never copy a passage or its \
        "Note ... :" heading. If the passages don't answer it, say you couldn't find it in the notes.
        """
    }

    /// Asks the model whether a message is small talk (a greeting, thanks, a question about the
    /// assistant) rather than about the notes. Lite labels it wrong when only told the rules (13
    /// of 25), right with examples (20 of 25, and never "CHAT" for a question about notes).
    static let chatCheckPrompt = """
    Label the message CHAT or NOTES. CHAT: greetings, thanks, small talk, questions about the \
    assistant. NOTES: asks about the user's own recordings, plans, people, tasks, numbers or topics.
    Examples:
    hey there -> CHAT
    thanks a lot -> CHAT
    what are you? -> CHAT
    when is the team offsite? -> NOTES
    what did Alex say about pricing -> NOTES
    groceries -> NOTES
    Reply with the label only.
    """

    /// The reply to small talk, without the notes or tools.
    static let chatPrompt = """
    You are Voxbrief's assistant: you find things in the user's own voice notes and answer \
    questions about them. Reply to this message in one or two short, friendly sentences. \
    Don't make up anything about their notes.
    """

    /// Whether the model calls the message small talk. Anything but a clear "CHAT" counts as a
    /// question about the notes, so an unsure answer still searches.
    static func isSmallTalk(_ question: String, engine: AskEngine) async throws -> Bool {
        let reply = try await engine.respond(
            [AskMessage(role: .system, content: chatCheckPrompt), AskMessage(role: .user, content: question)],
            [], "", 4
        )
        return reply
            .replacing(/<think>[\s\S]*?<\/think>/, with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
            .hasPrefix("CHAT")
    }

    /// The model's final reply as the answer: thinking and stray tool tags removed, "[n]"
    /// citations turned into links to their notes.
    func finish(_ reply: String, engine: String) -> AskAnswer {
        var text = reply
            .replacing(/<think>[\s\S]*?<\/think>/, with: "")
            .replacing(/<tool_call>[\s\S]*?(<\/tool_call>|$)/, with: "")
            .replacingOccurrences(of: "<think>", with: "")
            .replacingOccurrences(of: "</think>", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let (body, numbers) = Self.strippingInlineCitations(text)
        text = body
        if text.isEmpty {
            text = searchesThisQuestion.isEmpty
                ? "I couldn't come up with an answer. Try asking another way."
                : "I searched your notes but couldn't put together an answer. Try asking another way."
        }
        var seen: Set<String> = []
        let citations = numbers.compactMap { number -> AskAnswer.Citation? in
            guard passages.indices.contains(number - 1) else { return nil }
            let passage = passages[number - 1]
            let citation = AskAnswer.Citation(noteId: passage.noteId, noteTitle: passage.noteTitle, startTime: passage.startTime)
            return seen.insert(citation.id).inserted ? citation : nil
        }
        return AskAnswer(text: text, citations: citations, searches: searchesThisQuestion, engine: engine)
    }

    /// "…by Wednesday [1]." / "(Source 2)" become citation numbers, and leave the text.
    static func strippingInlineCitations(_ text: String) -> (String, [Int]) {
        var sources: [Int] = []
        for match in text.matches(of: /\s*(?:\[(\d+(?:\s*,\s*\d+)*)\]|\((?:[Ss]ources?|[Pp]assages?)\s*(\d+)\))/) {
            let numbers = String(match.1 ?? match.2 ?? "")
            sources += numbers.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        }
        let body = text.replacing(/\s*(?:\[\d+(?:\s*,\s*\d+)*\]|\((?:[Ss]ources?|[Pp]assages?)\s*\d+\))/, with: "")
        return (body.trimmingCharacters(in: .whitespacesAndNewlines), sources)
    }
}

#if canImport(FoundationModels)
/// `search_notes` for Apple Intelligence's own tool calling.
@available(iOS 26.0, macOS 26.0, *)
struct SearchNotesTool: Tool {
    let name = "search_notes"
    let description = AskConversation.searchToolDescription
    let run: @Sendable (String, Int?) async -> String

    @Generable
    struct Arguments {
        @Guide(description: "Words from the question to look for, plus a few synonyms.")
        var query: String
        @Guide(description: "Only when the question names a time (\"this week\": 7, \"yesterday\": 1). Leave it out otherwise.")
        var daysBack: Int?
    }

    func call(arguments: Arguments) async throws -> String {
        await run(arguments.query, arguments.daysBack.flatMap { $0 > 0 ? $0 : nil })
    }
}

/// `notes_on_dates` for Apple Intelligence.
@available(iOS 26.0, macOS 26.0, *)
struct NotesOnDatesTool: Tool {
    let name = AskConversation.datesToolName
    let description = AskConversation.datesToolDescription
    let run: @Sendable (String, String?) async -> String

    @Generable
    struct Arguments {
        @Guide(description: "The first day, as YYYY-MM-DD.")
        var from: String
        @Guide(description: "The last day, as YYYY-MM-DD. Leave it out for a single day.")
        var to: String?
    }

    func call(arguments: Arguments) async throws -> String {
        await run(arguments.from, arguments.to)
    }
}

/// `open_todos` for Apple Intelligence.
@available(iOS 26.0, macOS 26.0, *)
struct OpenTodosTool: Tool {
    let name = AskConversation.todosToolName
    let description = AskConversation.todosToolDescription
    let run: @Sendable (Int?) async -> String

    @Generable
    struct Arguments {
        @Guide(description: "Only to-dos from notes of the last N days. Leave it out for all.")
        var daysBack: Int?
    }

    func call(arguments: Arguments) async throws -> String {
        await run(arguments.daysBack.flatMap { $0 > 0 ? $0 : nil })
    }
}
#endif
