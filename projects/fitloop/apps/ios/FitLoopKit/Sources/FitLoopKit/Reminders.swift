import Foundation

/// The local notifications FitLoop schedules from the plan and the user's reminder switches: before
/// each workout, at each meal, the evening check-in nudge and the weekly review for the agent.
/// Pure (the app hands it to UNUserNotificationCenter), so it's tested. iOS keeps at most 64 pending
/// notifications, so it plans a week ahead and the app re-plans on every launch and plan change.
public struct Reminder: Hashable, Sendable {
    public var id: String
    public var date: DateComponents
    public var title: String
    public var body: String
}

public enum ReminderPlanner {
    public static let maxPending = 60

    public static func plan(_ published: PublishedPlan?, settings: Settings, from today: String, days: Int = 7, calendar: Calendar = .current) -> [Reminder] {
        var out: [Reminder] = []
        let r = settings.reminders
        for offset in 0..<days {
            let date = Day.adding(offset, to: today, calendar: calendar)
            let day = published.flatMap { dayPlan($0.plan, date) }
            if let day {
                if r.workout.on {
                    for w in day.workouts {
                        guard let (h, m) = Day.time(w.time) else { continue }
                        let total = h * 60 + m - r.workout.minutesBefore
                        guard total >= 0 else { continue }
                        let firstEx = w.exercises.first.map { "First up: \($0.name), \($0.sets) × \($0.target)." } ?? ""
                        out.append(Reminder(id: "workout:\(date):\(w.id)", date: components(date, total / 60, total % 60, calendar),
                                            title: r.workout.minutesBefore > 0 ? "\(w.title) in \(r.workout.minutesBefore) min" : "Time for \(w.title)",
                                            body: "\(w.durationMin) min. \(firstEx)".trimmingCharacters(in: .whitespaces)))
                    }
                }
                if r.meals.on {
                    for m in day.meals {
                        guard let (h, mi) = Day.time(m.time) else { continue }
                        out.append(Reminder(id: "meal:\(date):\(m.id)", date: components(date, h, mi, calendar), title: m.name,
                                            body: m.items.map { "\($0.name) \($0.amount)" }.joined(separator: ", ")))
                    }
                }
                if r.evening.on, !day.workouts.isEmpty || !day.meals.isEmpty, let (h, m) = Day.time(r.evening.time) {
                    out.append(Reminder(id: "evening:\(date)", date: components(date, h, m, calendar), title: "How did today go?",
                                        body: "Check off what you did and leave your agent a note."))
                }
            }
            if r.weekly.on, Day.weekday(date, calendar: calendar) == r.weekly.weekday, let (h, m) = Day.time(r.weekly.time) {
                out.append(Reminder(id: "weekly:\(date)", date: components(date, h, m, calendar), title: "Weekly review",
                                    body: "Ask your agent to review the week in FitLoop and update your plan."))
            }
        }
        return Array(out.sorted { (calendar.date(from: $0.date) ?? .distantFuture) < (calendar.date(from: $1.date) ?? .distantFuture) }.prefix(maxPending))
    }

    /// The day plan for a date: an override, else the week's day; nil outside the plan's dates.
    public static func dayPlan(_ plan: Plan, _ date: String) -> DayPlan? {
        if date < plan.startsOn { return nil }
        if let end = plan.endsOn, date > end { return nil }
        return plan.overrides?[date] ?? plan.week[Day.weekday(date)]
    }

    static func components(_ date: String, _ h: Int, _ m: Int, _ calendar: Calendar) -> DateComponents {
        let p = date.split(separator: "-").compactMap { Int($0) }
        return DateComponents(calendar: calendar, timeZone: calendar.timeZone, year: p[0], month: p[1], day: p[2], hour: h, minute: m)
    }
}
