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

        // an entry and its undo in one outbox: rows of different shapes (PGRST102 before)
        let tapped = try await s.log(type: "diaper", fields: ["kind": .string("dirty")], provenance: Provenance(surface: .phone, input: .tap))
        try await s.undo(tapped.id)
        let r3 = try await s.sync()
        XCTAssertEqual(r3.pushed, 2)

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

    func testChildrenSaveAndReadBack() async throws {
        let client = SupabaseClient(config: .local)
        _ = try await client.signIn(email: "parent1@example.com", password: "newborn-dev")
        let first = try await client.myHousehold()
        var h = try XCTUnwrap(first)
        let leo = UUID(uuidString: "00000000-0000-4000-8000-00000000b0b0")!
        h.babies.removeAll { $0.id == leo }
        h.babies.append(Baby(id: leo, name: "Leo", birthDate: h.birthDate, color: "teal", bottleMl: 150, position: 1))
        try await client.saveSettings(h)

        let fetched = try await client.myHousehold()
        let back = try XCTUnwrap(fetched)
        XCTAssertEqual(back.babyName, "Mia")                       // single-child builds still see the first child
        let saved = try XCTUnwrap(back.baby(leo))
        XCTAssertEqual(saved.name, "Leo")
        XCTAssertEqual(saved.color, "teal")
        XCTAssertEqual(saved.bottleMl, 150)
        XCTAssertFalse(saved.archived)
        XCTAssertEqual(Calendar.current.startOfDay(for: try XCTUnwrap(saved.birthDate)), Calendar.current.startOfDay(for: try XCTUnwrap(h.birthDate)))

        // a capture can carry the device's child
        let cap = Capture(householdId: back.id, surface: .glasses, capturedAt: Date(), loggedBy: client.session!.userId,
                          transcript: "wet diaper", babyId: leo, status: .dismissed)
        try await client.pushCaptures([cap])

        // archived: kept, but out of `active`, so the seed household's first child stays Mia
        h = back
        h.babies[h.babies.firstIndex { $0.id == leo }!].archived = true
        try await client.saveSettings(h)
        let again = try await client.myHousehold()
        let archived = try XCTUnwrap(again)
        XCTAssertFalse(archived.active.contains { $0.id == leo })
        XCTAssertEqual(archived.babyName, "Mia")
        XCTAssertTrue(try XCTUnwrap(archived.baby(leo)).archived)
    }
}
