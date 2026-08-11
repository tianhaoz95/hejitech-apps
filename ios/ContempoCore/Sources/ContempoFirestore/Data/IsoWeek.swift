import FirebaseFirestore
import Foundation

/// ISO-8601 week id ("GGGG-Www", e.g. "2026-W33") for the current instant,
/// computed in UTC so every device + the backend agree on which week "now"
/// falls in regardless of local timezone. `Calendar(identifier: .iso8601)`'s
/// `.yearForWeekOfYear`/`.weekOfYear` components give the real ISO week
/// number directly (Monday-start, week 1 = the week containing the year's
/// first Thursday) — the same rule Android's `WeekFields.ISO` and the
/// backend's hand-rolled TS helper (`backend/functions/src/tokenUsage.ts`)
/// both implement, so all three should agree; verified against ISO week-1
/// boundary dates as part of this feature's rollout rather than assumed.
func currentIsoWeekId() -> String {
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())
    return String(format: "%04d-W%02d", components.yearForWeekOfYear ?? 0, components.weekOfYear ?? 0)
}

/// Monday 00:00 UTC of the ISO week containing now — stored alongside the
/// counters so Settings can show "week of ...". Deliberately uses a plain
/// Gregorian calendar's well-documented Sunday=1...Saturday=7 `.weekday`
/// numbering for the Monday-offset arithmetic rather than reading `.weekday`
/// back off the iso8601 calendar (whose weekday numbering isn't as
/// consistently documented across Foundation versions) — same "don't rely
/// on ambiguous behavior" reasoning applies to the year/week number above,
/// which Apple does explicitly document.
func currentIsoWeekStart() -> Timestamp {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    let now = Date()
    let weekday = calendar.component(.weekday, from: now) // 1 = Sunday ... 7 = Saturday
    let daysSinceMonday = (weekday + 5) % 7 // Sunday->6, Monday->0, ..., Saturday->5
    let startOfDay = calendar.startOfDay(for: now)
    let monday = calendar.date(byAdding: .day, value: -daysSinceMonday, to: startOfDay) ?? startOfDay
    return Timestamp(date: monday)
}
