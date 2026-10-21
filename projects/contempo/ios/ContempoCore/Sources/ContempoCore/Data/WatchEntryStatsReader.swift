import Foundation
@preconcurrency import Supabase

/// Confirmed hours for the watch's progress views: the owner's confirmed minutes this tax year
/// (contempo.entries, RLS-scoped to the signed-in user), the same figure as the phone's
/// Dashboard (`TestYearProgress`). 0 when signed out or offline.
public final class WatchEntryStatsReader: Sendable {
    public init() {}

    private struct Minutes: Decodable {
        let duration_minutes: Int
        let role_id: String?
    }

    public func confirmedHours(now: Date = Date(), calendar: Calendar = .current) async -> Double {
        guard ContempoBackend.uid != nil,
              let year = calendar.dateInterval(of: .year, for: now) else { return 0 }
        let rows: [Minutes] = (try? await ContempoBackend.client.from("entries")
            .select("duration_minutes,role_id")
            .eq("status", value: "confirmed")
            .gte("activity_date", value: year.start.ISO8601Format())
            .lt("activity_date", value: year.end.ISO8601Format())
            .execute().value) ?? []
        // Role-tagged entries are someone else's hours (`Entry.isOwnerHours`).
        let ownerMinutes = rows.filter { ($0.role_id ?? "").isEmpty }.reduce(0) { $0 + $1.duration_minutes }
        return Double(ownerMinutes) / 60.0
    }
}
