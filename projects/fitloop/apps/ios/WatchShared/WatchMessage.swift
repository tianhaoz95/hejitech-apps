import Foundation

/// What the iPhone and the Watch say to each other over WatchConnectivity (compiled into both).
///
///   phone → watch  application context: the open workout (or none) and where it is
///   watch → phone  message: heart rate samples, "set done"; user info: "workout ended" with what
///                  the watch measured (it must arrive even if the phone app isn't in front)
enum WatchMessage {
    // Application context keys (phone → watch).
    static let workoutRef = "workoutRef"
    static let workoutTitle = "workoutTitle"
    static let exerciseName = "exerciseName"
    static let setLine = "setLine"
    static let restUntil = "restUntil"
    static let progress = "progress"
    /// The plan's workout kind (strength, cardio…), so Health gets the right workout type.
    static let workoutKind = "workoutKind"
    /// The iPhone's "Save workouts to Health" switch (false: the watch discards the workout).
    static let saveToHealth = "saveToHealth"

    // Message keys (watch → phone).
    static let kind = "kind"
    static let hr = "hr"
    static let kindHeartRate = "hr"
    static let kindSetDone = "setDone"
    static let kindEnded = "ended"

    // The summary sent with kindEnded (what the watch measured; any may be missing).
    static let endedRef = "ref"
    static let avgHr = "avgHr"
    static let maxHr = "maxHr"
    static let durationSec = "durationSec"
    static let energyKcal = "energyKcal"
    static let savedToHealth = "savedToHealth"
}

/// Today's progress, sent phone → watch as user info and kept for the watch face complication.
struct DayProgress: Codable, Equatable {
    /// The day it describes, local YYYY-MM-DD.
    var date: String
    /// 0…1, the Worker's day completion.
    var completion: Double
    var workoutsDone: Int
    var workoutsTotal: Int
    var mealsDone: Int
    var mealsTotal: Int
    /// The next workout or meal still to do.
    var next: String?

    static let userInfoKey = "dayProgress"

    static func localDate(_ d: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    var isToday: Bool { date == Self.localDate() }
}

#if os(watchOS)
import Security

/// The watch app and its complication share no App Group, so today's progress lives in a Keychain
/// item in a shared access group (`keychain-access-groups` in both targets' entitlements).
enum DayProgressStore {
    private static let group = "68CTFST8W2.com.hejitech.fitloop.watchshared"
    private static let account = "dayProgress"

    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrAccessGroup as String: group,
         kSecAttrService as String: "com.hejitech.fitloop", kSecAttrAccount as String: account]
    }

    static func load() -> DayProgress? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return try? JSONDecoder().decode(DayProgress.self, from: data)
    }

    static func save(_ p: DayProgress) {
        guard let data = try? JSONEncoder().encode(p) else { return }
        let attrs: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock]
        if SecItemUpdate(query as CFDictionary, attrs as CFDictionary) == errSecItemNotFound {
            SecItemAdd(query.merging(attrs) { $1 } as CFDictionary, nil)
        }
    }
}
#endif
