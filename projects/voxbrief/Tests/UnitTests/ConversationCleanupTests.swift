import XCTest
@testable import Voxbrief

/// Cleaning a conversation turn by turn, driven by a scripted engine (no model runs here).
final class ConversationCleanupTests: XCTestCase {

    private final class Calls: @unchecked Sendable {
        private let lock = NSLock()
        private var users: [String] = []
        func add(_ user: String) { lock.lock(); users.append(user); lock.unlock() }
        var all: [String] { lock.lock(); defer { lock.unlock() }; return users }
    }

    func testTurnsAreCleanedInOneBatchAndKeepTheirOrder() async throws {
        let service = LLMCopywriterService()
        let calls = Calls()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { system, user, _ in
            calls.add(user)
            XCTAssertEqual(system, service.buildTurnsSystemPrompt(dictionary: []))
            return #"{"turns": ["1. How have you been feeling?", "The itching got worse at night."]}"#
        }

        let cleaned = try await service.cleanUpTurns(
            ["how have you uh been feeling", "the itching um got worse at night"],
            dictionary: [],
            engine: engine
        )

        XCTAssertEqual(calls.all, [#"The 2 turns, as a JSON array; answer with {"turns": [...]} holding exactly 2 strings:"# + "\n" + #"["how have you uh been feeling","the itching um got worse at night"]"#])
        XCTAssertEqual(cleaned.texts, ["How have you been feeling?", "The itching got worse at night."])
        XCTAssertEqual(cleaned.engine, "Test")
    }

    func testAnswerWithTheWrongCountKeepsTheTurnsTidied() async throws {
        let service = LLMCopywriterService()
        var answers = [
            #"{"turns": ["Merged both turns into one."]}"#,
            #"{"turns": []}"#,
            #"{"turns": ["A later batch that worked fine here."]}"#
        ]
        let lock = NSLock()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { _, _, _ in
            lock.lock(); defer { lock.unlock() }
            return answers.removeFirst()
        }
        let long = Array(repeating: "word", count: 500).joined(separator: " ")

        let cleaned = try await service.cleanUpTurns(
            ["um first turn here", "second um turn", long, "a later batch that worked fine here"],
            dictionary: [],
            engine: engine
        )

        XCTAssertEqual(cleaned.texts[0], "First turn here", "Fillers removed without the model")
        XCTAssertEqual(cleaned.texts[1], "Second turn")
        XCTAssertEqual(cleaned.texts[3], "A later batch that worked fine here.")
        XCTAssertTrue(answers.isEmpty)
    }

    func testASummarizedTurnIsNotUsed() {
        let service = LLMCopywriterService()
        let input = "so we talked about the bile acid level and it takes about a week to come back and the liver tests look fine"
        let parsed = service.parseTurns(#"{"turns": ["Tests discussed."]}"#, inputs: [input])
        let answers = try? XCTUnwrap(parsed)
        XCTAssertEqual(answers?.count, 1)
        XCTAssertEqual(answers?.first, .some(nil), "Too short to be the same turn proofread")
    }

    func testNoBatchCleanedThrowsSoTheNextEngineIsTried() async {
        let service = LLMCopywriterService()
        let engine = LLMCopywriterService.StageTwoEngine(label: "Test") { _, _, _ in "not json" }
        do {
            _ = try await service.cleanUpTurns(["one turn", "another turn"], dictionary: [], engine: engine)
            XCTFail("Expected a throw")
        } catch {}
    }

    func testBatchesStayUnderTheWordTarget() {
        let turn = Array(repeating: "word", count: 200).joined(separator: " ")
        XCTAssertEqual(LLMCopywriterService.turnBatches([turn, turn, turn, "short"]), [0..<2, 2..<4])
        XCTAssertEqual(LLMCopywriterService.turnBatches(Array(repeating: "hi", count: 20)), [0..<12, 12..<20])
    }
}
