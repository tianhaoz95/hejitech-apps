import Foundation
@preconcurrency import Supabase

/// Confirmed hours for the watch's progress views: the sum of confirmed entries' minutes
/// (contempo.entries, RLS-scoped to the signed-in user). 0 when signed out or offline.
public final class WatchEntryStatsReader: Sendable {
    public init() {}

    private struct Minutes: Decodable { let duration_minutes: Int }

    public func confirmedHours() async -> Double {
        guard ContempoBackend.uid != nil else { return 0 }
        let rows: [Minutes] = (try? await ContempoBackend.client.from("entries")
            .select("duration_minutes")
            .eq("status", value: "confirmed")
            .execute().value) ?? []
        return Double(rows.reduce(0) { $0 + $1.duration_minutes }) / 60.0
    }
}
