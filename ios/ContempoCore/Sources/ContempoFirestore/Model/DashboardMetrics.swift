import Foundation

/// Confirmed hours logged under someone else's role — surfaced next to the
/// owner's own progress so a host can visually confirm their hours exceed
/// any other individual's, the comparison the 100-hour/material
/// participation tests actually require.
public struct RoleHoursSummary: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let hours: Double

    public init(id: String, name: String, hours: Double) {
        self.id = id
        self.name = name
        self.hours = hours
    }
}

/// Pure computation over a raw entry list, extracted out of
/// `DashboardViewModel` so this logic (owner-vs-other-role hour splitting,
/// the actual 100-hour/500-hour-test-relevant math) is unit-testable without
/// constructing a ViewModel — which would otherwise reach into
/// `ServiceLocator`'s live Firestore repository as a side effect of `init()`.
public struct DashboardMetrics: Equatable, Sendable {
    /// Only entries with no role tagged (i.e. the owner's own hours) — see
    /// `Entry.isOwnerHours`. Deliberately NOT every confirmed hour; the
    /// 100-hour/500-hour tests require the owner's participation to exceed
    /// everyone else's, so other roles' hours must never inflate this.
    public let confirmedHours: Double
    /// Other roles' confirmed hours, for audit-context comparison.
    public let otherRoleHours: [RoleHoursSummary]
    /// Excludes the open timer/trip — they're "still running," not "needs completing."
    public let pendingCount: Int
    /// The one open start/stop timer, if any.
    public let openTimerEntry: Entry?
    /// The one open mileage trip, if any. Scoped by isTrip so it and openTimerEntry never match the same entry.
    public let openTripEntry: Entry?
    /// Sum of `miles` across every entry — a separate tax deduction from the hours progress above.
    public let totalMiles: Double

    public init(
        confirmedHours: Double,
        otherRoleHours: [RoleHoursSummary],
        pendingCount: Int,
        openTimerEntry: Entry?,
        openTripEntry: Entry?,
        totalMiles: Double
    ) {
        self.confirmedHours = confirmedHours
        self.otherRoleHours = otherRoleHours
        self.pendingCount = pendingCount
        self.openTimerEntry = openTimerEntry
        self.openTripEntry = openTripEntry
        self.totalMiles = totalMiles
    }

    public static func compute(from entries: [Entry]) -> DashboardMetrics {
        let confirmed = entries.filter { $0.statusEnum == .confirmed }
        let ownerConfirmed = confirmed.filter(\.isOwnerHours)
        let confirmedHours = ownerConfirmed.reduce(0) { $0 + Double($1.durationMinutes) } / 60.0

        let othersConfirmed = confirmed.filter { !$0.isOwnerHours }
        var hoursByRole: [String: (name: String, minutes: Int)] = [:]
        for entry in othersConfirmed {
            let key = entry.roleId ?? entry.roleName ?? "unknown"
            let name = (entry.roleName?.isEmpty ?? true) ? "Other" : entry.roleName!
            hoursByRole[key, default: (name: name, minutes: 0)].minutes += entry.durationMinutes
        }
        let otherRoleHours = hoursByRole.map { key, value in
            RoleHoursSummary(id: key, name: value.name, hours: Double(value.minutes) / 60.0)
        }.sorted { $0.hours > $1.hours }

        return DashboardMetrics(
            confirmedHours: confirmedHours,
            otherRoleHours: otherRoleHours,
            pendingCount: entries.filter { $0.statusEnum == .pendingReview && !$0.inProgress }.count,
            openTimerEntry: entries.first { $0.inProgress && !$0.isTrip },
            openTripEntry: entries.first { $0.inProgress && $0.isTrip },
            totalMiles: entries.reduce(0) { $0 + $1.miles }
        )
    }
}
