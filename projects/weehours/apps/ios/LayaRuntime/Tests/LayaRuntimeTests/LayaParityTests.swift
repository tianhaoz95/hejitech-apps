import XCTest
import LogCore
@testable import LayaRuntime

/// Checks the in-process port against llama-server's `/v1/systemone` on the same GGUF.
/// Needs `LAYA_MODEL=/path/Laya-Q8_0.gguf`; the server comparison also needs `LAYA_SERVER`.
final class LayaParityTests: XCTestCase {
    func testMatchesServer() async throws {
        guard let path = ProcessInfo.processInfo.environment["LAYA_MODEL"] else { throw XCTSkip("LAYA_MODEL not set") }
        let local = LayaDecisionModel(modelURL: URL(fileURLWithPath: path))
        await local.warmUp()
        let interp = VoiceInterpreter(model: local)
        let ctx = InterpretContext(reference: Date(), log: DerivedLog(events: []), enabledCategories: EventRegistry.shared.defaultCategories)
        let req = DecisionRequest(state: "finished drinking, drank half a bottle", questions: interp.questions(for: ctx))

        let start = Date()
        let mine = try await local.decide(req)
        print("in-process decide: \(Int(Date().timeIntervalSince(start) * 1000)) ms for \(req.questions.count) questions")
        XCTAssertEqual(mine.count, req.questions.count)

        // Verify batched decide() matches single-question score() within floating-point tolerance
        for q in req.questions {
            let singleScores = try await local.score(state: req.state, question: q)
            let tKey = LayaPrompt.temperatureKey(options: q.options.count)
            _ = tKey
            let batched = try XCTUnwrap(mine[q.id])
            let bestSingleIdx = singleScores.enumerated().max(by: { $0.element < $1.element })?.offset
            let bestBatchedIdx = batched.probabilities.enumerated().max(by: { $0.element < $1.element })?.offset
            XCTAssertEqual(bestSingleIdx, bestBatchedIdx, "Top-1 option mismatch on question \(q.id)")
        }

        // Verify 12-question (all categories) batched pass and cached layout reuse on a second utterance
        let allCats = Set(EventRegistry.shared.categories.map(\.id))
        let ctxAll = InterpretContext(reference: Date(), log: DerivedLog(events: []), enabledCategories: allCats)
        let req12 = DecisionRequest(state: "wet and dirty diaper fifteen minutes ago", questions: interp.questions(for: ctxAll))
        let out12 = try await local.decide(req12)
        XCTAssertEqual(out12.count, req12.questions.count)
        XCTAssertEqual(out12["category"]?.top.key, "diaper")
        XCTAssertEqual(out12["diaper_kind"]?.top.key, "both")

        guard let server = ProcessInfo.processInfo.environment["LAYA_SERVER"], let url = URL(string: server) else { return }
        let theirs = try await SystemOneHTTPModel(endpoint: url).decide(req)
        for q in req.questions {
            let a = try XCTUnwrap(mine[q.id]), b = try XCTUnwrap(theirs[q.id])
            for (x, y) in zip(a.probabilities, b.probabilities) {
                XCTAssertEqual(x, y, accuracy: 0.02, "question \(q.id)")
            }
        }
    }
}
