import XCTest
@testable import LogCore

/// Runs against a local `supabase start` with seed data. Enabled with SUPABASE_IT=1 (CI does).
final class BackendIntegrationTests: XCTestCase {
    override func setUp() async throws {
        if ProcessInfo.processInfo.environment["SUPABASE_IT"] != "1" { throw XCTSkip("set SUPABASE_IT=1 with local supabase running") }
    }

    func testSignInPullPushAndCaptureRoundTrip() async throws {
        let client = SupabaseClient(config: .local)
        _ = try await client.signIn(email: "parent2@example.com", password: "newborn-dev")
        let fetched = try await client.myHousehold()
        let h = try XCTUnwrap(fetched)
        XCTAssertEqual(h.babyName, "Mia")
        XCTAssertEqual(h.caregivers.count, 2)

        let s = LogService(store: try SQLiteLogStore.inMemory(), household: h, me: client.session!.userId,
                           interpreter: VoiceInterpreter(model: KeywordDecisionModel()), backend: client)
        let report = try await s.sync()
        XCTAssertGreaterThan(report.pulled, 10)
        let e = try await s.log(type: "diaper", fields: ["kind": .string("wet")], provenance: Provenance(surface: .phone, input: .tap))
        let r2 = try await s.sync()
        XCTAssertEqual(r2.pushed, 1)

        // a second phone sees it
        let other = SupabaseClient(config: .local)
        _ = try await other.signIn(email: "parent1@example.com", password: "newborn-dev")
        let s2 = LogService(store: try SQLiteLogStore.inMemory(), household: h, me: other.session!.userId,
                            interpreter: VoiceInterpreter(model: KeywordDecisionModel()), backend: other)
        try await s2.sync()
        let seen = try await s2.derived()
        XCTAssertTrue(seen.all.contains { $0.id == e.id })

        // a glasses-style capture with a transcript is processed by a phone
        let cap = Capture(householdId: h.id, surface: .glasses, capturedAt: Date().addingTimeInterval(-60), loggedBy: other.session!.userId,
                          transcript: "big poop diaper")
        try await other.pushCaptures([cap])
        let processed = try await s.processRemoteCaptures()
        XCTAssertGreaterThanOrEqual(processed, 1)
        try await s.sync()
        try await s2.sync()
        let log2 = try await s2.derived()
        let open = try await other.openCaptures(household: h.id)
        XCTAssertTrue(log2.all.contains { $0.id == cap.eventId } || open.contains { $0.id == cap.id && $0.status == .needsReview })
    }
}
