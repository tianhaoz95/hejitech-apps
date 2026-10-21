import ContempoCore
import Foundation

/// The owner's progress toward `MaterialParticipationTest` for the current tax year.
///
/// The 100-hour/500-hour tests are annual: only hours whose *activity* falls in the
/// tax year (the calendar year, in the device's time zone) count, so a host who logged
/// 100 hours last year starts this year at zero. Mirrors Android's `TestYearProgress.kt`
/// and the web's `testYearProgress` (services/web/src/lib/metrics.ts).
public struct TestYearProgress: Equatable, Sendable {
    public enum Pace: Equatable, Sendable {
        /// The year's hours already reach the threshold.
        case met
        /// At the pace so far, the threshold is reached on `finish` (before the year ends).
        case onPace(finish: Date)
        /// The pace so far (or no hours yet) misses the year end; this many hours a week
        /// from today reach the threshold by Dec 31.
        case behind(weeklyHoursNeeded: Double)
    }

    /// The pace is measured over at least this many days, so one long entry yesterday
    /// doesn't project the whole test done in a few weeks.
    public static let minimumPaceWindowDays = 14

    public let year: Int
    /// The owner's confirmed hours with activity in `year`.
    public let ownerHours: Double
    public let pace: Pace

    public init(year: Int, ownerHours: Double, pace: Pace) {
        self.year = year
        self.ownerHours = ownerHours
        self.pace = pace
    }

    /// Whether `entry`'s activity falls in `year`.
    public static func isInYear(_ entry: Entry, year: Int, calendar: Calendar = .current) -> Bool {
        calendar.component(.year, from: entry.activityDate.dateValue()) == year
    }

    public static func compute(
        from entries: [Entry],
        thresholdHours: Int = MaterialParticipationTest.thresholdHours,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> TestYearProgress {
        let year = calendar.component(.year, from: now)
        let counted = entries.filter {
            $0.statusEnum == .confirmed && $0.isOwnerHours && isInYear($0, year: year, calendar: calendar)
        }
        let hours = counted.reduce(0) { $0 + Double($1.durationMinutes) } / 60.0
        let threshold = Double(thresholdHours)
        guard hours < threshold else { return TestYearProgress(year: year, ownerHours: hours, pace: .met) }

        let today = calendar.startOfDay(for: now)
        let nextYear = calendar.date(from: DateComponents(year: year + 1, month: 1, day: 1)) ?? today
        let remaining = threshold - hours
        let daysLeft = max(1, days(from: today, to: nextYear, calendar: calendar))

        if let first = counted.map({ $0.activityDate.dateValue() }).min(), hours > 0 {
            let firstDay = calendar.startOfDay(for: min(first, now))
            let window = max(minimumPaceWindowDays, days(from: firstDay, to: today, calendar: calendar) + 1)
            let daysNeeded = Int((remaining / (hours / Double(window))).rounded(.up))
            if daysNeeded < daysLeft, let finish = calendar.date(byAdding: .day, value: daysNeeded, to: today) {
                return TestYearProgress(year: year, ownerHours: hours, pace: .onPace(finish: finish))
            }
        }
        return TestYearProgress(year: year, ownerHours: hours, pace: .behind(weeklyHoursNeeded: remaining / Double(daysLeft) * 7))
    }

    private static func days(from start: Date, to end: Date, calendar: Calendar) -> Int {
        calendar.dateComponents([.day], from: start, to: end).day ?? 0
    }
}
