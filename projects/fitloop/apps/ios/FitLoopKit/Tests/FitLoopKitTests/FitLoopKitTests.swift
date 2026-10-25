import XCTest
@testable import FitLoopKit

/// Fixtures are the Worker's real responses for the seed athlete (captured from the local stack).
final class FitLoopKitTests: XCTestCase {
    func fixture(_ name: String) throws -> Data {
        try Data(contentsOf: Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")!)
    }

    func testDecodesToday() throws {
        let t = try Backend.decoder.decode(TodayResponse.self, from: fixture("today"))
        XCTAssertEqual(t.state.day?.title, "Full body A")
        let w = try XCTUnwrap(t.state.workouts.first)
        XCTAssertEqual(w.exercises[1].exercise.target, "8-10 reps @ 24 kg")
        XCTAssertEqual(w.exercises[4].exercise.target, "40 s")
        XCTAssertEqual(w.next?.exercise, 0)
        XCTAssertEqual(t.state.meals.count, 4)
        XCTAssertEqual(t.state.nutrition.targets.calories, 2200)
    }

    func testDecodesPlanProgressFeedbackSettings() throws {
        let p = try Backend.decoder.decode(PlanResponse.self, from: fixture("plan"))
        XCTAssertEqual(p.current?.plan.week.count, 7)
        XCTAssertEqual(p.versions.first?.version, p.current?.version)
        let pr = try Backend.decoder.decode(ProgressResponse.self, from: fixture("progress"))
        XCTAssertEqual(pr.adherence.days.count, 14)
        let f = try Backend.decoder.decode([Feedback].self, from: fixture("feedback"))
        XCTAssertTrue(f.contains { $0.tags.contains("pain") })
        let s = try Backend.decoder.decode(SettingsResponse.self, from: fixture("settings"))
        XCTAssertTrue(s.settings.reminders.evening.on)
        XCTAssertFalse(s.settings.vitals.photos)
    }

    func testSettingsRoundTripWithSnakeCase() throws {
        let data = try Backend.encoder.encode(Settings.defaults)
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertNotNil(obj["agent_access"])
        XCTAssertEqual((obj["reminders"] as? [String: Any]).flatMap { ($0["workout"] as? [String: Any])?["minutes_before"] as? Int }, 10)
        XCTAssertEqual(try Backend.decoder.decode(Settings.self, from: data), Settings.defaults)
    }

    func testCheckinEncodesSnakeCase() throws {
        let c = NewCheckin(date: "2026-10-26", ref: "full-body-a/plank/1", kind: "set", status: "done", data: CheckinData(durationSec: 40, avgHr: 131))
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: Backend.encoder.encode(c)) as? [String: Any])
        let d = try XCTUnwrap(obj["data"] as? [String: Any])
        XCTAssertEqual(d["duration_sec"] as? Int, 40)
        XCTAssertEqual(d["avg_hr"] as? Int, 131)
    }

    func testDays() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        XCTAssertEqual(Day.weekday("2026-10-26", calendar: cal), "mon")
        XCTAssertEqual(Day.weekday("2026-11-01", calendar: cal), "sun")
        XCTAssertEqual(Day.adding(7, to: "2026-10-28", calendar: cal), "2026-11-04")
        XCTAssertNil(Day.time("25:00"))
    }

    func testReminders() throws {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let plan = try XCTUnwrap(Backend.decoder.decode(PlanResponse.self, from: fixture("plan")).current)
        var settings = Settings.defaults
        var monday = plan.plan.startsOn
        while Day.weekday(monday, calendar: cal) != "mon" { monday = Day.adding(1, to: monday, calendar: cal) }
        let all = ReminderPlanner.plan(plan, settings: settings, from: monday, calendar: cal)
        let workout = try XCTUnwrap(all.first { $0.id.hasPrefix("workout:") })
        XCTAssertEqual(workout.date.hour, 11)
        XCTAssertEqual(workout.date.minute, 50)
        XCTAssertEqual(workout.title, "Full body A in 10 min")
        XCTAssertTrue(all.contains { $0.id == "meal:\(monday):lunch" })
        XCTAssertTrue(all.contains { $0.id == "evening:\(monday)" })
        XCTAssertEqual(all.filter { $0.id.hasPrefix("weekly:") }.count, 1)
        XCTAssertLessThanOrEqual(all.count, ReminderPlanner.maxPending)
        settings.reminders.meals.on = false
        settings.reminders.evening.on = false
        XCTAssertFalse(ReminderPlanner.plan(plan, settings: settings, from: monday, calendar: cal).contains { $0.id.hasPrefix("meal:") || $0.id.hasPrefix("evening:") })
        XCTAssertTrue(ReminderPlanner.plan(nil, settings: settings, from: monday, calendar: cal).allSatisfy { $0.id.hasPrefix("weekly:") })
    }

    func testErrorMessagesComeFromTheWorker() {
        XCTAssertEqual(BackendError.http(422, #"{"error":"no meal lunch on 2026-10-26"}"#).errorDescription, "no meal lunch on 2026-10-26")
    }
}
