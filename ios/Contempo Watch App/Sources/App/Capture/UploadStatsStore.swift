import Foundation

/// Tiny persisted "how many recordings uploaded today" counter — mirrors
/// Android Wear's `UploadStatsStore`. Local, upload-time bookkeeping, not
/// derived from Firestore: the `audioCaptures` queue doc is deleted once the
/// phone processes it, so it can't answer "how many uploaded today" after
/// the fact.
final class UploadStatsStore {
    private static let dateKey = "upload_stats_date"
    private static let countKey = "upload_stats_count"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    private var today: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.string(from: Date())
    }

    func recordUpload() {
        let count = defaults.string(forKey: Self.dateKey) == today ? defaults.integer(forKey: Self.countKey) + 1 : 1
        defaults.set(today, forKey: Self.dateKey)
        defaults.set(count, forKey: Self.countKey)
    }

    func uploadedTodayCount() -> Int {
        defaults.string(forKey: Self.dateKey) == today ? defaults.integer(forKey: Self.countKey) : 0
    }
}
