import ContempoCore
import ContempoData
import XCTest

final class TestYearProgressTests: XCTestCase {
    private var calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        return calendar
    }()

    private func date(_ year: Int, _ month: Int, _ day: Int, hour: Int = 12) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour))!
    }

    private func entry(_ minutes: Int, on date: Date, roleId: String? = nil, status: EntryStatus = .confirmed) -> Entry {
        Entry(
            task: "Turnover",
            durationMinutes: minutes,
            status: status.firestoreValue,
            activityDate: Timestamp(date: date),
            roleId: roleId,
            roleName: roleId == nil ? nil : "Cleaner"
        )
    }

    /// The tests are annual: last year's hours must not count toward this year's threshold.
    func testOnlyThisYearsHoursCount() {
        let now = date(2027, 1, 2)
        let entries = [entry(100 * 60, on: date(2026, 11, 5)), entry(90, on: date(2027, 1, 1))]

        let progress = TestYearProgress.compute(from: entries, now: now, calendar: calendar)

        XCTAssertEqual(progress.year, 2027)
        XCTAssertEqual(progress.ownerHours, 1.5, accuracy: 0.0001)
        XCTAssertNotEqual(progress.pace, .met)
    }

    /// The year boundary is the device's local midnight, not UTC's.
    func testNewYearsEveLateNightStaysInTheOldYear() {
        let lateOnNewYearsEve = date(2026, 12, 31, hour: 23)
        let progress = TestYearProgress.compute(
            from: [entry(60, on: lateOnNewYearsEve)],
            now: date(2026, 12, 31, hour: 23),
            calendar: calendar
        )

        XCTAssertEqual(progress.year, 2026)
        XCTAssertEqual(progress.ownerHours, 1, accuracy: 0.0001)
    }

    func testOtherRolesAndPendingEntriesDontCount() {
        let now = date(2026, 10, 21)
        let entries = [
            entry(120, on: date(2026, 10, 1)),
            entry(600, on: date(2026, 10, 1), roleId: "role-1"),
            entry(300, on: date(2026, 10, 1), status: .pendingReview),
        ]

        let progress = TestYearProgress.compute(from: entries, now: now, calendar: calendar)

        XCTAssertEqual(progress.ownerHours, 2, accuracy: 0.0001)
    }

    func testThresholdReachedIsMet() {
        let progress = TestYearProgress.compute(
            from: [entry(100 * 60, on: date(2026, 6, 1))],
            now: date(2026, 10, 21),
            calendar: calendar
        )

        XCTAssertEqual(progress.pace, .met)
    }

    /// 50 hours since Jul 1 (113 days through Oct 21) is ~0.44 h/day, so the other 50
    /// take 113 more days: past Dec 31, so the pace line asks for a weekly rate instead.
    func testSlowPaceAsksForWeeklyHours() {
        let now = date(2026, 10, 21)
        let progress = TestYearProgress.compute(
            from: [entry(50 * 60, on: date(2026, 7, 1))],
            now: now,
            calendar: calendar
        )

        // 72 days from Oct 21 to Jan 1, 50 hours left: 50 / 72 * 7.
        guard case .behind(let weekly) = progress.pace else { return XCTFail("expected behind, got \(progress.pace)") }
        XCTAssertEqual(weekly, 50.0 / 72.0 * 7.0, accuracy: 0.0001)
    }

    /// 80 hours since Jul 1 is ~0.71 h/day, so the last 20 take 29 days: Nov 19.
    func testFastPaceProjectsAFinishDate() {
        let now = date(2026, 10, 21)
        let progress = TestYearProgress.compute(
            from: [entry(80 * 60, on: date(2026, 7, 1))],
            now: now,
            calendar: calendar
        )

        XCTAssertEqual(progress.pace, .onPace(finish: calendar.startOfDay(for: date(2026, 11, 19))))
    }

    /// One long day yesterday is measured over the minimum window, not a single day.
    func testPaceWindowHasAMinimum() {
        let now = date(2026, 3, 2)
        let progress = TestYearProgress.compute(
            from: [entry(10 * 60, on: date(2026, 3, 1))],
            now: now,
            calendar: calendar
        )

        // 10 h over 14 days → 126 more days for 90 h → Jul 6, not 18 days from now.
        XCTAssertEqual(progress.pace, .onPace(finish: calendar.startOfDay(for: date(2026, 7, 6))))
    }

    func testNoHoursYetAsksForWeeklyHours() {
        let progress = TestYearProgress.compute(from: [], now: date(2026, 1, 1), calendar: calendar)

        guard case .behind(let weekly) = progress.pace else { return XCTFail("expected behind") }
        XCTAssertEqual(weekly, 100.0 / 365.0 * 7.0, accuracy: 0.0001)
    }

    func testDashboardMetricsUseTheSameYear() {
        let now = date(2027, 1, 2)
        let entries = [
            entry(100 * 60, on: date(2026, 11, 5)),
            entry(600, on: date(2026, 11, 5), roleId: "role-1"),
            entry(60, on: date(2027, 1, 1)),
        ]

        let metrics = DashboardMetrics.compute(from: entries, now: now, calendar: calendar)

        XCTAssertEqual(metrics.confirmedHours, 1, accuracy: 0.0001)
        XCTAssertEqual(metrics.testProgress.year, 2027)
        XCTAssertTrue(metrics.otherRoleHours.isEmpty, "last year's cleaner hours aren't this year's comparison")
    }
}
