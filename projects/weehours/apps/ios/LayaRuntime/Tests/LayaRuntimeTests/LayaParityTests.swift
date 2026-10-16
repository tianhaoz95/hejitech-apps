import XCTest
import LogCore
@testable import LayaRuntime

/// Checks the in-process port against llama-server's `/v1/systemone` on the same GGUF.
/// Needs `LAYA_MODEL=/path/Laya-Q8_0.gguf`; the server comparison also needs `LAYA_SERVER`.
final class LayaParityTests: XCTestCase {
    func testMatchesServer() async throws {
        guard let path = ProcessInfo.processInfo.environment["LAYA_MODEL"] else { throw XCTSkip("LAYA_MODEL not set") }
        let local = LayaDecisionModel(modelURL: URL(fileURLWithPath: path))
        let interp = VoiceInterpreter(model: local)
        let ctx = InterpretContext(reference: Date(), log: DerivedLog(events: []), enabledCategories: EventRegistry.shared.defaultCategories)
        let req = DecisionRequest(state: "finished drinking, drank half a bottle", questions: interp.questions(for: ctx))

        let start = Date()
        let mine = try await local.decide(req)
        print("in-process decide: \(Int(Date().timeIntervalSince(start) * 1000)) ms for \(req.questions.count) questions")
        XCTAssertEqual(mine.count, req.questions.count)

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
