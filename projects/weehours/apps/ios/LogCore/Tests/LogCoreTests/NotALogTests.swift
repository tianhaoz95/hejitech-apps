import XCTest
@testable import LogCore

/// Answers "none of these" to the category question with probability `none`, else the keywords.
private struct NoneModel: DecisionModel {
    let none: Double
    var version: String { "none-stub" }
    func decide(_ request: DecisionRequest) async throws -> [String: DecisionAnswer] {
        var out = try await KeywordDecisionModel().decide(request)
        if let q = request.questions.first(where: { $0.id == "category" }) {
            let rest = (1 - none) / Double(q.options.count - 1)
            out["category"] = DecisionAnswer(options: q.options.map(\.key),
                                             probabilities: q.options.map { $0.key == VoiceInterpreter.noneKey ? none : rest })
        }
        return out
    }
}

final class NotALogTests: XCTestCase {
    private func service(none: Double) throws -> LogService {
        var h = Household(id: H, babyId: B, bottleMl: 120, caregivers: [Caregiver(id: A, name: "Alex")])
        h.categories = EventRegistry.shared.categories.map(\.id)
        return LogService(store: try SQLiteLogStore.inMemory(), household: h, me: A,
                          interpreter: VoiceInterpreter(model: NoneModel(none: none)))
    }

    func testConfidentNotALogIsKeptAsANoteWithoutAsking() async throws {
        let s = try service(none: 0.97)
        let r = try await s.processVoice(transcript: "grandma is coming at noon", surface: .phone)
        XCTAssertEqual(r.capture.status, .dismissed)
        XCTAssertEqual(r.events.map(\.type), [SystemType.note])
        let reviews = try await s.store.captures().filter { $0.status == .needsReview }
        XCTAssertTrue(reviews.isEmpty)
    }

    func testLogItReopensTheFullListAndTakesTheNoteBack() async throws {
        let s = try service(none: 0.97)
        let r = try await s.processVoice(transcript: "grandma is coming at noon", surface: .phone)
        let note = try XCTUnwrap(r.events.first)
        try await s.reopenCapture(r.capture.id, note: note.id)
        let capture = try await s.store.captures().first { $0.id == r.capture.id }
        XCTAssertEqual(capture?.status, .needsReview)
        XCTAssertFalse(capture?.interpretation?.candidates.isEmpty ?? true)
        let log = try await s.derived()
        XCTAssertEqual(log.status[note.id], .undone)
    }

    func testUnsureNotALogStillAsks() async throws {
        let s = try service(none: 0.6)
        let r = try await s.processVoice(transcript: "grandma is coming at noon", surface: .phone)
        XCTAssertEqual(r.capture.status, .needsReview)
        XCTAssertTrue(r.events.isEmpty)
    }

    func testKeywordFallbackNeverKeepsAnUnmatchedSentenceAsANote() async throws {
        let s = try keywordService()
        let r = try await s.processVoice(transcript: "she had her bottle", surface: .phone)
        XCTAssertNotEqual(r.capture.status, .dismissed)
        let r2 = try await s.processVoice(transcript: "grandma is coming at noon", surface: .phone)
        XCTAssertEqual(r2.capture.status, .needsReview)
    }
}

// the tests' usual service (keyword model); `service(none:)` above shadows its name inside the class
private func keywordService() throws -> LogService { try service() }
