import XCTest
@testable import Voxbrief

/// Ask Voxbrief: keyword index ranking and the keywords -> search -> answer flow, with a
/// scripted engine standing in for the on-device model.
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

    func testAskFlowCitesThePassagesTheModelUsed() async throws {
        let notes = [
            note("Q4 roadmap sync", transcript: "I promised Priya the offline spec by Wednesday."),
            note("Errands", transcript: "Pharmacy pickup and return the drill."),
        ]
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, _, _ in
            if system.contains("search keywords") {
                return ##"{"keywords": ["Priya", "promise", "spec"], "days": null}"##
            }
            return ##"{"answer": "You promised Priya the offline spec by Wednesday.", "sources": [1], "found": true}"##
        }
        let answer = try await AskService().ask("What did I promise Priya?", engine: engine, notes: notes, now: now)
        XCTAssertEqual(answer.text, "You promised Priya the offline spec by Wednesday.")
        XCTAssertEqual(answer.citations.map(\.noteTitle), ["Q4 roadmap sync"])
        XCTAssertEqual(answer.keywords, ["Priya", "promise", "spec"])
        XCTAssertFalse(answer.notFound)
    }

    func testNothingFoundSkipsTheAnswerCall() async throws {
        let calls = Counter()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { _, _, _ in
            await calls.increment()
            return ##"{"keywords": ["volcano"], "days": null}"##
        }
        let answer = try await AskService().ask("Anything about volcanoes?", engine: engine, notes: [note("Errands", transcript: "milk and eggs")], now: now)
        XCTAssertTrue(answer.notFound)
        let count = await calls.value
        XCTAssertEqual(count, 1)
    }

    func testUnparsableKeywordsFallBackToQuestionWords() {
        XCTAssertNil(AskService.parseKeywords("sure! here are some keywords"))
        XCTAssertEqual(AskService.contentWords("What did Dana recommend?"), ["Dana", "recommend"])
    }

    func testProseAnswerIsShownUncited() {
        let parsed = AskService.parseAnswer("You told Priya Wednesday.")
        XCTAssertEqual(parsed.answer, "You told Priya Wednesday.")
        XCTAssertEqual(parsed.sources, [])
    }

    // MARK: - Answers built from the notes

    func testOpenActionItemsAreListedWithoutTheModel() async throws {
        var reno = note("Kitchen reno", transcript: "call the contractor")
        reno.actionItems = ["Call the contractor", "Order tiles"]
        reno.completedActionItems = ["Order tiles"]
        reno.actionItemPriorities = ["Call the contractor": "high"]
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { _, _, _ in
            XCTFail("Listing action items shouldn't call the model")
            return ""
        }
        let answer = try await AskService().ask("What are my open action items?", engine: engine, notes: [reno], now: now)
        XCTAssertEqual(answer.kind, .listed)
        XCTAssertEqual(answer.text, "You have 1 open action item, 1 of them high priority.")
        XCTAssertEqual(answer.points.map(\.text), ["Call the contractor"])
        XCTAssertEqual(answer.points.first?.detail, "High")
        XCTAssertEqual(answer.points.first?.citation.noteTitle, "Kitchen reno")
        XCTAssertNil(answer.engine)
    }

    func testNotesFromYesterdayAreListed() {
        let calendar = Calendar.current
        let yesterdayNoon = calendar.date(byAdding: .day, value: -1, to: calendar.startOfDay(for: now))!.addingTimeInterval(12 * 3600)
        var recent = note("Errands", transcript: "pharmacy pickup")
        recent.createdAt = yesterdayNoon
        recent.summary = "Pharmacy pickup and the drill."
        var older = note("Old", transcript: "something", daysAgo: 5)
        older.summary = "Old stuff."
        let answer = AskService.directAnswer("What did I record yesterday?", notes: [recent, older], now: now)
        XCTAssertEqual(answer?.kind, .listed)
        XCTAssertEqual(answer?.text, "You recorded 1 note yesterday:")
        XCTAssertEqual(answer?.points.map(\.citation.noteTitle), ["Errands"])
        XCTAssertEqual(answer?.points.first?.text, "Pharmacy pickup and the drill.")
    }

    func testNoNotesInTheRangeSaysSo() {
        let answer = AskService.directAnswer("What ideas did I have last week?", notes: [note("Old", transcript: "x", daysAgo: 20)], now: now)
        XCTAssertEqual(answer?.kind, .listed)
        XCTAssertTrue(answer?.text.hasPrefix("You didn't record any notes in the last 7 days.") == true)
    }

    func testTopicQuestionsGoToSearch() {
        XCTAssertNil(AskService.directAnswer("What did I promise Priya last week?", notes: [], now: now))
        XCTAssertNil(AskService.directAnswer("What did I want to do about the garden?", notes: [], now: now))
    }

    // MARK: - What the model sends back

    func testPlaceholderAnswerFallsBackToQuotedPassages() async throws {
        let notes = [note("Q4 roadmap sync", transcript: "I promised Priya the offline spec by Wednesday.")]
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, _, _ in
            system.contains("search keywords")
                ? ##"{"keywords": ["Priya", "spec"], "days": null}"##
                : ##"{"answer": "found", "sources": [1], "found": true}"##
        }
        let answer = try await AskService().ask("What did I promise Priya?", engine: engine, notes: notes, now: now)
        XCTAssertEqual(answer.kind, .excerpts)
        XCTAssertTrue(answer.points.first?.text.contains("Priya the offline spec") == true)
        XCTAssertNotEqual(answer.text, "found")
    }

    func testNotFoundWithUnrelatedPassagesSaysNothingWasFound() async throws {
        let notes = [note("Errands", transcript: "Pharmacy pickup and return the drill.")]
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, _, _ in
            system.contains("search keywords")
                ? ##"{"keywords": ["dentist", "pharmacy"], "days": null}"##
                : ##"{"answer": "No answer", "sources": [], "found": false}"##
        }
        let answer = try await AskService().ask("When is my dentist appointment?", engine: engine, notes: notes, now: now)
        XCTAssertEqual(answer.kind, .notFound)
        XCTAssertEqual(answer.text, "I couldn't find anything about that in your notes.")
    }

    func testLenientJSON() {
        let fenced = AskService.parseAnswer("```json\n{\"answer\": \"You said Wednesday.\", \"sources\": [\"1\"], \"found\": \"true\"}\n```")
        XCTAssertEqual(fenced, AskService.ParsedAnswer(answer: "You said Wednesday.", sources: [1], notFound: false))

        let stringFlag = AskService.parseAnswer(##"{"answer": "Nothing on that.", "sources": [], "found": "false"}"##)
        XCTAssertTrue(stringFlag.notFound)

        let list = AskService.parseAnswer(##"{"answer": ["Call Sam", "Book the room"], "sources": [2]}"##)
        XCTAssertEqual(list.answer, "• Call Sam\n• Book the room")

        let cutOff = AskService.parseAnswer(##"{"answer": "You promised Priya the spec by Wed"##)
        XCTAssertEqual(cutOff.answer, "You promised Priya the spec by Wed")
    }

    func testUnreadableJSONIsNeverShown() {
        XCTAssertEqual(AskService.parseAnswer(##"{"sources": [1, "found": true"##).answer, "")
    }

    func testInlineCitationsBecomeSources() {
        let parsed = AskService.parseAnswer("You promised Priya the spec [1]. The room is booked (Source 2).")
        XCTAssertEqual(parsed.answer, "You promised Priya the spec. The room is booked.")
        XCTAssertEqual(parsed.sources, [1, 2])
    }

    func testPlaceholderDetection() {
        for placeholder in ["found", "Found.", "No answer", "No answer provided", "true"] {
            XCTAssertTrue(AskService.isUnusable(placeholder, question: "What did I promise?", hits: []), placeholder)
        }
        XCTAssertFalse(AskService.isUnusable("Wednesday.", question: "When is it due?", hits: []))
    }
}

private actor Counter {
    private(set) var value = 0
    func increment() { value += 1 }
}
