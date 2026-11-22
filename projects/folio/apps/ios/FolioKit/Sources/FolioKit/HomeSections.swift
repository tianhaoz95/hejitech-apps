import Foundation

/// What the home screen shows, worked out from the artifact list: three counts at the top, what
/// needs your review, your favorites, then everything else by when it last changed (Today, This
/// week, Earlier). An artifact appears once: in review if it needs it, else in favorites, else in
/// its day group. Plain logic, no UI, so it's tested in FolioKitTests.
public struct HomeSections: Equatable, Sendable {
    public var review: [ArtifactSummary]
    public var favorites: [ArtifactSummary]
    public var today: [ArtifactSummary]
    public var thisWeek: [ArtifactSummary]
    public var earlier: [ArtifactSummary]

    /// Open suggestions you can review, over every artifact.
    public var suggestionsToReview: Int
    /// Artifacts changed since midnight.
    public var changedToday: Int
    /// Unresolved comments over every artifact; nil when the server doesn't send counts.
    public var openComments: Int?

    public init(_ artifacts: [ArtifactSummary], now: Date = Date(), calendar: Calendar = .current) {
        let startOfToday = calendar.startOfDay(for: now)
        let weekStart = calendar.date(byAdding: .day, value: -6, to: startOfToday) ?? startOfToday
        let sorted = artifacts.sorted { $0.updated_at > $1.updated_at }
        review = sorted.filter(\.needsReview)
        let others = sorted.filter { !$0.needsReview }
        favorites = others.filter(\.isFavorite)
        let rest = others.filter { !$0.isFavorite }
        today = rest.filter { $0.updated_at >= startOfToday }
        thisWeek = rest.filter { $0.updated_at < startOfToday && $0.updated_at >= weekStart }
        earlier = rest.filter { $0.updated_at < weekStart }
        suggestionsToReview = review.reduce(0) { $0 + $1.open_suggestions }
        changedToday = artifacts.filter { $0.updated_at >= startOfToday }.count
        openComments = artifacts.contains { $0.unresolved_comments != nil }
            ? artifacts.reduce(0) { $0 + ($1.unresolved_comments ?? 0) }
            : nil
    }

    /// The day groups that have artifacts, in order, with their headers.
    public var dayGroups: [(title: String, artifacts: [ArtifactSummary])] {
        [("Today", today), ("This week", thisWeek), ("Earlier", earlier)].filter { !$0.1.isEmpty }
    }

    /// A short time for a row: "Now", "12m", "3h" today, "Yesterday", a weekday this week, else
    /// "Nov 14" (with the year when it isn't this year).
    public static func shortTime(_ date: Date, now: Date = Date(), calendar: Calendar = .current, locale: Locale = .current) -> String {
        let seconds = now.timeIntervalSince(date)
        if calendar.isDate(date, inSameDayAs: now) {
            if seconds < 60 { return "Now" }
            if seconds < 3600 { return "\(Int(seconds / 60))m" }
            return "\(Int(seconds / 3600))h"
        }
        if calendar.isDate(date, inSameDayAs: calendar.date(byAdding: .day, value: -1, to: now) ?? now) { return "Yesterday" }
        var style = Date.FormatStyle(locale: locale, calendar: calendar, timeZone: calendar.timeZone)
        if seconds < 6 * 86400 { return date.formatted(style.weekday(.abbreviated)) }
        style = calendar.isDate(date, equalTo: now, toGranularity: .year) ? style.month(.abbreviated).day() : style.month(.abbreviated).day().year()
        return date.formatted(style)
    }
}
