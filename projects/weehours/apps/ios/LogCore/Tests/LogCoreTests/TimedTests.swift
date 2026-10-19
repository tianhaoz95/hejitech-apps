import XCTest
@testable import LogCore

/// Timed activities (start, stop) and the "still going?" nudges for sessions left open.
final class TimedTests: XCTestCase {
    private let tap = Provenance(surface: .phone, input: .tap)

    private func service() async throws -> (LogService, Household) {
        var h = Household(id: H, babyId: B, bottleMl: 120, caregivers: [Caregiver(id: A, name: "Alex")])
        h.categories = EventRegistry.shared.categories.map(\.id)
        h.reminders.feedEveryMinutes = nil
        h.reminders.diaperEveryMinutes = nil
        let s = LogService(store: try SQLiteLogStore.inMemory(), household: h, me: A, interpreter: VoiceInterpreter(model: KeywordDecisionModel()))
        return (s, h)
    }

    /// Noon today, so the nap rule (daytime only) applies.
    private var noon: Date { Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: Date())! }

    func testStartAndStopRecordTheMinutes() async throws {
        let (s, _) = try await service()
        let start = Date().addingTimeInterval(-12 * 60)
        let e = try await s.startTimed("tummy_time", at: start)
        var log = try await s.derived()
        XCTAssertEqual(log.effective.first { $0.type == "tummy_time" }?.fields["ongoing"], .bool(true))
        XCTAssertEqual(VoiceInterpreter.label(type: "tummy_time", fields: ["ongoing": .bool(true)]), "Tummy time · in progress")
        try await s.stopTimed(e.id)
        log = try await s.derived()
        let done = try XCTUnwrap(log.effective.first { $0.type == "tummy_time" })
        XCTAssertNil(done.fields["ongoing"])
        XCTAssertEqual(done.fields["minutes"], .number(12))
        XCTAssertEqual(done.occurredAt.timeIntervalSince1970, start.timeIntervalSince1970, accuracy: 1)
        XCTAssertEqual(log.effective.filter { $0.type == "tummy_time" }.count, 1)   // the edit replaced the running entry
    }

    func testForgottenTimerNudgesAtItsNorm() async throws {
        let (s, h) = try await service()
        let start = noon.addingTimeInterval(-10 * 60)
        let e = try await s.startTimed("tummy_time", at: start)
        var plan = ReminderPlanner.plan(log: try await s.derived(), household: h, me: A, now: noon)
        let nudge = try XCTUnwrap(plan.first { $0.kind == .stillActivity })
        XCTAssertEqual(nudge.fireAt.timeIntervalSince(start), 30 * 60, accuracy: 1)   // tummy time: 30 min
        XCTAssertFalse(nudge.escalated)
        XCTAssertTrue(nudge.message.hasPrefix("Tummy time has been going 30m"))
        try await s.stopTimed(e.id, at: noon)
        plan = ReminderPlanner.plan(log: try await s.derived(), household: h, me: A, now: noon)
        XCTAssertTrue(plan.isEmpty)
    }

    func testOpenSessionsNudge() async throws {
        let (s, h) = try await service()
        try await s.log(type: "feed.breast.start", fields: ["side": .string("left")], occurredAt: noon.addingTimeInterval(-600), provenance: tap)
        try await s.log(type: "sleep.start", occurredAt: noon.addingTimeInterval(-600), provenance: tap)
        let plan = ReminderPlanner.plan(log: try await s.derived(), household: h, me: A, now: noon)
        let feed = try XCTUnwrap(plan.first { $0.kind == .stillFeeding })
        XCTAssertEqual(feed.fireAt.timeIntervalSince(noon), 50 * 60, accuracy: 1)      // nursing: 60 min from start
        XCTAssertTrue(feed.message.hasPrefix("Still nursing?"))
        let nap = try XCTUnwrap(plan.first { $0.kind == .stillSleeping })
        XCTAssertEqual(nap.fireAt.timeIntervalSince(noon), 170 * 60, accuracy: 1)      // naps: 3 h
    }

    func testNightSleepDoesntNudge() async throws {
        let (s, h) = try await service()
        let night = Calendar.current.date(bySettingHour: 23, minute: 0, second: 0, of: Date())!
        try await s.log(type: "sleep.start", occurredAt: night, provenance: tap)
        let plan = ReminderPlanner.plan(log: try await s.derived(), household: h, me: A, now: night.addingTimeInterval(60))
        XCTAssertNil(plan.first { $0.kind == .stillSleeping })
    }
}
