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
        func record(_ messages: [AskMessage], _ tools: Int, _ prefill: String) {
            lock.withLock { calls.append((messages, tools, prefill)) }
        }
        var all: [(messages: [AskMessage], tools: Int, prefill: String)] { lock.withLock { calls } }
    }

    private func engine(startsWithSearch: Bool = false, script: Script, reply: @escaping @Sendable ([AskMessage], String) -> String) -> AskEngine {
        AskEngine(label: "Test", startsWithSearch: startsWithSearch) { messages, tools, prefill, _ in
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
        XCTAssertEqual(calls[0].tools, 1, "The model is offered the search tool")
        XCTAssertTrue(calls[1].messages.last?.content.contains("[1] Note \"Q4 roadmap sync\"") == true, "It reads numbered passages")
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

    // MARK: - The search tool

    func testATimeLimitWithNothingInItFallsBackToAllNotes() {
        let ask = conversation([note("Errands", transcript: "Return the drill.", daysAgo: 30)])
        let latest = ask.search(query: "", daysBack: 1)
        XCTAssertTrue(latest.hasPrefix("Nothing in the last 1 day. Older notes:"))
        XCTAssertTrue(latest.contains("Errands"))
        // Keyword searches only rank recent notes first (a model often adds a limit the question
        // didn't ask for), so an older match is still found.
        XCTAssertTrue(ask.search(query: "drill", daysBack: 1).hasPrefix("[2] Note \"Errands\""))
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
        XCTAssertTrue(second.hasPrefix("[\(ask.passages.count)]"))
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
