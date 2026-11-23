import XCTest
@testable import Voxbrief

/// Ask Voxbrief: keyword index ranking and the agent loop (the model searching with
/// `search_notes`, then answering), with a scripted engine standing in for the model.
@MainActor
final class AskServiceTests: XCTestCase {

    private let now = Date(timeIntervalSince1970: 1_792_400_000)

    private func note(_ title: String, transcript: String, daysAgo: Double = 1, segments: [TranscriptTimingSegment] = [], locked: Bool = false) -> VoiceNote {
        VoiceNote(
            createdAt: now.addingTimeInterval(-daysAgo * 86_400),
            duration: 120,
            audioFileName: "\(title).m4a",
            title: title,
            summary: "",
            rawTranscript: transcript,
            status: .ready,
            isLocked: locked,
            transcriptSegments: segments
        )
    }

    func testIndexRanksTheNoteThatMentionsTheTerms() {
        let notes = [
            note("Kitchen reno", transcript: "Ask the contractor about cabinet lead time and the sink permit."),
            note("Books", transcript: "Dana recommended Piranesi and The Overstory."),
        ]
        let hits = NoteSearchIndex(notes: notes).search(["contractor", "cabinets"])
        XCTAssertEqual(hits.first?.passage.noteTitle, "Kitchen reno")
        XCTAssertFalse(hits.contains { $0.passage.noteTitle == "Books" })
    }

    func testStemmingMatchesPlurals() {
        XCTAssertEqual(NoteSearchIndex.terms(in: "Contractors meeting"), ["contractor", "meet"])
    }

    func testLockedNotesAreNotSearched() {
        let hits = NoteSearchIndex(notes: [note("Secret", transcript: "bank password reminder", locked: true)]).search(["bank"])
        XCTAssertTrue(hits.isEmpty)
    }

    func testTimedTranscriptWindowsCarryStartTimes() {
        let segments = [
            TranscriptTimingSegment(start: 0, end: 5, text: "intro words here"),
            TranscriptTimingSegment(start: 42, end: 50, text: "the offline spec is due Wednesday"),
        ]
        let windows = NoteSearchIndex.transcriptWindows(for: note("Roadmap", transcript: "", segments: segments))
        XCTAssertEqual(windows.first?.startTime, 0)
        XCTAssertTrue(windows.first?.text.contains("Wednesday") == true)
    }

    func testRecentNotesAreBoosted() {
        let notes = [
            note("Old idea", transcript: "An idea about offline maps", daysAgo: 40),
            note("New idea", transcript: "An idea about offline maps", daysAgo: 2),
        ]
        let hits = NoteSearchIndex(notes: notes).search(["idea", "offline"], since: now.addingTimeInterval(-7 * 86_400))
        XCTAssertEqual(hits.first?.passage.noteTitle, "New idea")
    }


    // MARK: - The agent loop

    private final class Script: @unchecked Sendable {
        private let lock = NSLock()
        private var calls: [(messages: [AskMessage], tools: Int, prefill: String)] = []
        private var checked: [String] = []
        func recordCheck(_ question: String) { lock.withLock { checked.append(question) } }
        /// The messages asked "small talk or notes?", in order.
        var checks: [String] { lock.withLock { checked } }
        func record(_ messages: [AskMessage], _ tools: Int, _ prefill: String) {
            lock.withLock { calls.append((messages, tools, prefill)) }
        }
        var all: [(messages: [AskMessage], tools: Int, prefill: String)] { lock.withLock { calls } }
    }

    /// A scripted model. The small-talk check is answered by `label` (not recorded in `all`).
    private func engine(startsWithSearch: Bool = false, label: String = "NOTES", script: Script, reply: @escaping @Sendable ([AskMessage], String) -> String) -> AskEngine {
        AskEngine(label: "Test", startsWithSearch: startsWithSearch) { messages, tools, prefill, _ in
            if messages.first?.content == AskConversation.chatCheckPrompt {
                script.recordCheck(messages.last?.content ?? "")
                return label
            }
            script.record(messages, tools.count, prefill)
            return prefill + reply(messages, prefill)
        }
    }

    private func conversation(_ notes: [VoiceNote]) -> AskConversation {
        AskConversation(notes: { notes }, engines: { [] }, appleSessionAvailable: { false }, now: { [now] in now })
    }

    private let roadmap = "I promised Priya the offline spec by Wednesday."

    func testTheModelSearchesThenAnswersCitingWhatItRead() async throws {
        let ask = conversation([note("Q4 roadmap sync", transcript: roadmap), note("Errands", transcript: "Pharmacy pickup and return the drill.")])
        let script = Script()
        let model = engine(script: script) { messages, _ in
            messages.last?.role == .tool
                ? "You promised Priya the offline spec by Wednesday [1]."
                : "<tool_call>\n{\"name\": \"search_notes\", \"arguments\": {\"query\": \"Priya promise\"}}\n</tool_call>"
        }
        let answer = try await ask.ask("What did I promise Priya?", engine: model)

        XCTAssertEqual(answer.text, "You promised Priya the offline spec by Wednesday.")
        XCTAssertEqual(answer.searches.map(\.query), ["Priya promise"])
        XCTAssertEqual(answer.citations.first?.noteTitle, "Q4 roadmap sync")
        let calls = script.all
        XCTAssertEqual(calls.count, 2)
        XCTAssertEqual(calls[0].tools, 3, "Flash is offered search_notes, notes_on_dates and open_todos")
        XCTAssertTrue(calls[1].messages.last?.content.contains("Passage 1, from \"Q4 roadmap sync\"") == true, "It reads numbered passages")
        XCTAssertEqual(ask.history.map(\.role), [.user, .assistant, .tool, .assistant])
    }

    func testASmallModelsFirstReplyIsStartedAsASearch() async throws {
        let ask = conversation([note("Errands", transcript: "Pharmacy pickup and return the drill.")])
        let script = Script()
        let model = engine(startsWithSearch: true, script: script) { messages, prefill in
            prefill.isEmpty ? "You need to return the drill [1]." : "{\"query\": \"drill\"}}\n</tool_call>"
        }
        let answer = try await ask.ask("What do I return?", engine: model)
        XCTAssertEqual(script.all.first?.prefill, AskConversation.searchCallPrefill)
        XCTAssertEqual(answer.searches.map(\.query), ["drill"], "The model wrote the query itself")
        XCTAssertEqual(answer.citations.map(\.noteTitle), ["Errands"])
    }

    func testASmallModelRepliesToSmallTalkWithoutSearching() async throws {
        let ask = conversation([note("Errands", transcript: "Pharmacy pickup and return the drill.")])
        let script = Script()
        let model = engine(startsWithSearch: true, label: "CHAT", script: script) { _, _ in "Hi! What would you like to find?" }
        let answer = try await ask.ask("Hi", engine: model)
        XCTAssertEqual(answer.text, "Hi! What would you like to find?")
        XCTAssertTrue(answer.searches.isEmpty)
        XCTAssertEqual(script.checks, ["Hi"])
        XCTAssertEqual(script.all.map(\.prefill), [""], "No search was started")
        XCTAssertEqual(script.all.first?.tools, 0)
        XCTAssertEqual(script.all.first?.messages.first?.content, AskConversation.chatPrompt)
        XCTAssertEqual(ask.history.map(\.role), [.user, .assistant])
    }

    func testAnUnclearCheckStillSearches() async throws {
        let ask = conversation([note("Errands", transcript: "Pharmacy pickup and return the drill.")])
        let script = Script()
        let model = engine(startsWithSearch: true, label: "I think it is", script: script) { _, prefill in
            prefill.isEmpty ? "Return the drill [1]." : "{\"query\": \"drill\"}}\n</tool_call>"
        }
        let answer = try await ask.ask("drill?", engine: model)
        XCTAssertEqual(answer.searches.map(\.query), ["drill"])
    }

    func testAGreetingAnsweredWithoutSearchingStands() async throws {
        let ask = conversation([note("Errands", transcript: "Pharmacy pickup and return the drill.")])
        let script = Script()
        let model = engine(label: "CHAT", script: script) { _, _ in "Hello! Ask me about your notes." }
        let answer = try await ask.ask("Hello", engine: model)
        XCTAssertEqual(answer.text, "Hello! Ask me about your notes.")
        XCTAssertEqual(script.all.count, 1, "Not redone as a search")
        XCTAssertEqual(script.checks, ["Hello"])
    }

    func testAnAnswerBeforeAnySearchIsRetriedAsASearch() async throws {
        let ask = conversation([note("Errands", transcript: "Pharmacy pickup and return the drill.")])
        let script = Script()
        let model = engine(script: script) { messages, prefill in
            if !prefill.isEmpty { return "{\"query\": \"drill return\"}}\n</tool_call>" }
            return messages.last?.role == .tool ? "Return the drill [1]." : "Let me search your notes."
        }
        let answer = try await ask.ask("What do I return?", engine: model)
        XCTAssertEqual(script.all.map(\.prefill), ["", AskConversation.searchCallPrefill, ""])
        XCTAssertEqual(answer.text, "Return the drill.")
    }

    func testAFollowUpSeesTheEarlierTurnsAndCanAnswerWithoutSearching() async throws {
        let ask = conversation([note("Q4 roadmap sync", transcript: roadmap)])
        let script = Script()
        let model = engine(script: script) { messages, _ in
            if messages.last?.content == "By when?" { return "By Wednesday [1]." }
            return messages.last?.role == .tool ? "The offline spec [1]." : "<tool_call>\n{\"name\": \"search_notes\", \"arguments\": {\"query\": \"Priya\"}}\n</tool_call>"
        }
        _ = try await ask.ask("What did I promise Priya?", engine: model)
        let followUp = try await ask.ask("By when?", engine: model)

        XCTAssertEqual(followUp.text, "By Wednesday.")
        XCTAssertTrue(followUp.searches.isEmpty)
        XCTAssertEqual(followUp.citations.map(\.noteTitle), ["Q4 roadmap sync"], "[1] still means the first search's passage")
        let lastCall = try XCTUnwrap(script.all.last)
        XCTAssertTrue(lastCall.messages.contains { $0.content == "What did I promise Priya?" })
        XCTAssertEqual(lastCall.messages.first?.role, .system)
    }

    func testSearchesPerQuestionAreCapped() async throws {
        let ask = conversation([note("Errands", transcript: "milk and eggs")])
        let script = Script()
        let model = engine(script: script) { _, _ in
            "<tool_call>\n{\"name\": \"search_notes\", \"arguments\": {\"query\": \"milk\"}}\n</tool_call>"
        }
        let answer = try await ask.ask("Groceries?", engine: model)
        XCTAssertEqual(script.all.count, AskConversation.maxSteps)
        XCTAssertEqual(script.all.last?.tools, 0, "The last call has to answer")
        XCTAssertEqual(answer.searches.count, AskConversation.maxSteps - 1)
        XCTAssertTrue(answer.text.contains("couldn't put together an answer"))
    }

    func testOlderQuestionsKeepOnlyTheirQuestionAndAnswer() {
        var history: [AskMessage] = []
        for n in 1...3 {
            history += [
                AskMessage(role: .user, content: "Q\(n)"),
                AskMessage(role: .assistant, content: "<tool_call>\n{}\n</tool_call>"),
                AskMessage(role: .tool, content: "results \(n)"),
                AskMessage(role: .assistant, content: "A\(n)"),
            ]
        }
        let trimmed = AskConversation.trimmed(history)
        XCTAssertEqual(trimmed.prefix(2).map(\.content), ["Q1", "A1"])
        XCTAssertEqual(trimmed.count, 2 + 8)
    }

    // MARK: - Attached notes

    func testAnAttachedNoteIsReadWithoutASearchAndCanBeCited() async throws {
        let roadmapNote = note("Q4 roadmap sync", transcript: roadmap)
        let script = Script()
        let model = engine(startsWithSearch: true, label: "CHAT", script: script) { messages, prefill in
            XCTAssertTrue(prefill.isEmpty, "Not made to search first: the note is already in the prompt")
            return "You owe Priya the offline spec by Wednesday [2]."
        }
        let ask = AskConversation(notes: { [roadmapNote] }, engines: { [model] }, appleSessionAvailable: { false }, now: { [now] in now })
        let answer = try await ask.ask("What do I owe?", attached: roadmapNote)

        XCTAssertTrue(script.checks.isEmpty, "No small-talk check for a question about an attached note")
        XCTAssertEqual(script.all.count, 1)
        let prompt = script.all[0].messages.last?.content ?? ""
        XCTAssertTrue(prompt.contains("attached their note \"Q4 roadmap sync\""))
        XCTAssertTrue(prompt.contains("Passage 2, from \"Q4 roadmap sync\""))
        XCTAssertTrue(prompt.hasSuffix("Question: What do I owe?"))
        XCTAssertEqual(answer.searches.count, 0)
        XCTAssertEqual(answer.citations.map(\.noteTitle), ["Q4 roadmap sync"])
        XCTAssertEqual(ask.history.first?.question, "What do I owe?")
    }

    func testALongAttachedNoteIsCut() {
        let long = (1...3_000).map { "word\($0)" }.joined(separator: " ")
        let ask = conversation([])
        let context = ask.attachedContext(note("Long", transcript: long))
        XCTAssertTrue(context.contains("search_notes finds the rest"))
        let words = ask.passages.map { $0.text.split(separator: " ").count }.reduce(0, +)
        XCTAssertLessThanOrEqual(words, AskConversation.maxAttachedWords)
    }

    func testOlderQuestionsDropTheirAttachedNote() {
        var history: [AskMessage] = [
            AskMessage(role: .user, content: "Passages… Question: Q1", question: "Q1"),
            AskMessage(role: .assistant, content: "A1"),
        ]
        for n in 2...3 {
            history += [AskMessage(role: .user, content: "Q\(n)"), AskMessage(role: .assistant, content: "A\(n)")]
        }
        XCTAssertEqual(AskConversation.trimmed(history).map(\.content), ["Q1", "A1", "Q2", "A2", "Q3", "A3"])
    }

    func testOnlySearchableNotesCanBeAttached() {
        var archived = note("Archived", transcript: "x")
        archived.isArchived = true
        let notes = [note("Old", transcript: "a", daysAgo: 5), note("Locked", transcript: "b", locked: true), archived, note("New", transcript: "c", daysAgo: 1)]
        XCTAssertEqual(AskView.attachableNotes(notes).map(\.title), ["New", "Old"])
    }

    // MARK: - The search tool

    func testATimeLimitWithNothingInItFallsBackToAllNotes() {
        let ask = conversation([note("Errands", transcript: "Return the drill.", daysAgo: 30)])
        let latest = ask.search(query: "", daysBack: 1)
        XCTAssertTrue(latest.hasPrefix("Nothing in the last 1 day. Older notes:"))
        XCTAssertTrue(latest.contains("Errands"))
        // Keyword searches only rank recent notes first (a model often adds a limit the question
        // didn't ask for), so an older match is still found.
        XCTAssertTrue(ask.search(query: "drill", daysBack: 1).hasPrefix("Passage 2, from \"Errands\""))
    }

    func testAnEmptyQueryReturnsTheLatestNotes() {
        let ask = conversation([note("Older", transcript: "a", daysAgo: 5), note("Newer", transcript: "b", daysAgo: 1)])
        let result = ask.search(query: "", daysBack: nil)
        let newer = try! XCTUnwrap(result.range(of: "Newer"))
        let older = try! XCTUnwrap(result.range(of: "Older"))
        XCTAssertLessThan(newer.lowerBound, older.lowerBound)
    }

    func testPassagesAreNumberedAcrossTheConversation() {
        let ask = conversation([note("Errands", transcript: "Return the drill."), note("Books", transcript: "Dana recommended Piranesi.")])
        _ = ask.search(query: "drill", daysBack: nil)
        let second = ask.search(query: "Piranesi", daysBack: nil)
        XCTAssertTrue(second.hasPrefix("Passage \(ask.passages.count), from"))
        XCTAssertEqual(ask.search(query: "volcano", daysBack: nil), "No notes matched \"volcano\".")
    }

    func testToolCallsAreReadLeniently() {
        XCTAssertEqual(
            AskConversation.toolCall(in: "<tool_call>\n{\"name\": \"search_notes\", \"arguments\": {\"query\": \"budget\", \"days_back\": 0}}"),
            AskConversation.ToolCall(query: "budget", daysBack: nil), "Cut off, and 0 days is no limit"
        )
        XCTAssertEqual(
            AskConversation.toolCall(in: "<tool_call>{\"name\": \"search_notes\", \"arguments\": \"{\\\"query\\\": \\\"rent\\\", \\\"days\\\": \\\"7\\\"}\"}</tool_call>"),
            AskConversation.ToolCall(query: "rent", daysBack: 7)
        )
        XCTAssertNil(AskConversation.toolCall(in: "You promised Priya the spec."))
    }

    // MARK: - Dates and to-dos (Flash and Apple Intelligence)

    func testLiteHasOnlyTheSearchToolAndItsOwnPrompt() {
        let lite = AskEngine(label: "Lite", startsWithSearch: true) { _, _, _, _ in "" }
        let flash = AskEngine(label: "Flash") { _, _, _, _ in "" }
        XCTAssertEqual(AskConversation.tools(for: lite).count, 1)
        XCTAssertEqual(AskConversation.tools(for: flash).count, 3)
        XCTAssertFalse(AskConversation.systemPrompt(now: now).contains("notes_on_dates"), "Lite's prompt is unchanged")
        XCTAssertTrue(AskConversation.systemPrompt(now: now, allTools: true).contains("notes_on_dates"))
    }

    func testDateAndTodoCallsAreRead() {
        XCTAssertEqual(
            AskConversation.toolCall(in: "<tool_call>\n{\"name\": \"notes_on_dates\", \"arguments\": {\"from\": \"2026-10-20\", \"to\": \"2026-10-22\"}}\n</tool_call>"),
            AskConversation.ToolCall(name: "notes_on_dates", query: "", daysBack: nil, from: "2026-10-20", to: "2026-10-22")
        )
        XCTAssertEqual(
            AskConversation.toolCall(in: "<tool_call>\n{\"name\": \"open_todos\", \"arguments\": {\"days_back\": \"7\"}}"),
            AskConversation.ToolCall(name: "open_todos", query: "", daysBack: 7)
        )
        let call = AskConversation.ToolCall(name: "notes_on_dates", query: "", daysBack: nil, from: "2026-10-20")
        XCTAssertEqual(AskConversation.toolCall(in: AskConversation.normalizedCall(call)), call, "A normalized call reads back the same")
    }

    func testNotesOnDatesListsThatDaysNotesOldestFirst() {
        let day = Calendar.current.startOfDay(for: now.addingTimeInterval(-2 * 86_400))
        var morning = note("Standup", transcript: "Tom finished the login screen.")
        morning.createdAt = day.addingTimeInterval(9 * 3600)
        var evening = note("Garden", transcript: "Plant garlic before the frost.")
        evening.createdAt = day.addingTimeInterval(19 * 3600)
        let other = note("Dentist", transcript: "Call Dr. Lee.", daysAgo: 6)
        let ask = conversation([evening, other, morning])
        let iso = day.formatted(.iso8601.year().month().day())
        let result = ask.notesOnDates(from: iso, to: nil)
        let standup = try! XCTUnwrap(result.range(of: "Standup"))
        let garden = try! XCTUnwrap(result.range(of: "Garden"))
        XCTAssertLessThan(standup.lowerBound, garden.lowerBound)
        XCTAssertFalse(result.contains("Dentist"))
        XCTAssertTrue(result.hasPrefix("Passage 1, from"), "Numbered for citing")
        XCTAssertEqual(ask.passages.count, 2)
        XCTAssertTrue(ask.notesOnDates(from: "2020-01-01", to: "2020-01-31").hasPrefix("No notes were recorded between"))
        XCTAssertTrue(ask.notesOnDates(from: "last tuesday", to: nil).contains("isn't a date"))
    }

    func testOpenTodosSkipCheckedOffItemsAndLockedNotes() {
        var a = note("Trip", transcript: "x", daysAgo: 1)
        a.actionItems = ["Renew the passport", "Book the hotel"]
        a.completedActionItems = ["Book the hotel"]
        var b = note("Work", transcript: "y", daysAgo: 3)
        b.actionItems = ["Review Tom's pull request"]
        var done = note("Done", transcript: "z", daysAgo: 2)
        done.actionItems = ["Water plants"]
        done.completedActionItems = ["Water plants"]
        var secret = note("Secret", transcript: "s", daysAgo: 1, locked: true)
        secret.actionItems = ["Hidden"]
        let ask = conversation([b, done, a, secret])
        let all = ask.openTodos(daysBack: nil)
        XCTAssertTrue(all.contains("- Renew the passport"))
        XCTAssertFalse(all.contains("Book the hotel"))
        XCTAssertFalse(all.contains("Water plants") || all.contains("Hidden"))
        XCTAssertLessThan(try XCTUnwrap(all.range(of: "Trip")).lowerBound, try XCTUnwrap(all.range(of: "Work")).lowerBound, "Newest note first")
        XCTAssertFalse(ask.openTodos(daysBack: 2).contains("Review Tom's"))
    }

    func testFlashAnswersADateQuestionWithTheDatesTool() async throws {
        var monday = note("Budget sync", transcript: "The Q1 budget is 42,000 dollars.", daysAgo: 1)
        monday.createdAt = Calendar.current.startOfDay(for: now).addingTimeInterval(-86_400 + 10 * 3600)
        let ask = conversation([monday, note("Old", transcript: "something else", daysAgo: 9)])
        let yesterday = Calendar.current.startOfDay(for: now).addingTimeInterval(-86_400).formatted(.iso8601.year().month().day())
        let script = Script()
        let model = engine(script: script) { messages, _ in
            messages.last?.role == .tool
                ? "Yesterday you recorded the budget sync: the Q1 budget is 42,000 dollars [1]."
                : "<tool_call>\n{\"name\": \"notes_on_dates\", \"arguments\": {\"from\": \"\(yesterday)\"}}\n</tool_call>"
        }
        let answer = try await ask.ask("What did I record yesterday?", engine: model)
        XCTAssertEqual(answer.citations.first?.noteTitle, "Budget sync")
        XCTAssertEqual(answer.searches.first?.query, "notes \(yesterday)")
        XCTAssertFalse(script.all[1].messages.last?.content.contains("Old") ?? true)
    }

    func testInlineCitationsBecomeSources() {
        let (body, sources) = AskConversation.strippingInlineCitations("Due Wednesday [1, 3]. Also (Source 2).")
        XCTAssertEqual(body, "Due Wednesday. Also.")
        XCTAssertEqual(sources, [1, 3, 2])
    }

    func testThinkingAndStrayToolTagsAreNotShown() {
        let ask = conversation([])
        let answer = ask.finish("<think>hmm</think>\nYou have nothing due.<tool_call>{\"name\"", engine: "Test")
        XCTAssertEqual(answer.text, "You have nothing due.")
    }
}
