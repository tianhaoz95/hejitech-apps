import Foundation
import Security

/// Today's progress snapshot shared between the iPhone app and its Home Screen / Lock Screen widget.
/// Shared via a Keychain access group (no App Group: CI's API key can't register one).
struct TodaySnapshot: Codable, Equatable {
    var date: String
    var dayTitle: String
    var completion: Double
    var workoutsDone: Int
    var workoutsTotal: Int
    var mealsDone: Int
    var mealsTotal: Int
    var nextTitle: String?
    var nextWorkoutRef: String?

    static func localDate(_ d: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    var isToday: Bool { date == Self.localDate() }

    var deepLink: URL {
        if let ref = nextWorkoutRef, !ref.isEmpty,
           let encoded = ref.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
           let url = URL(string: "fitloop://workout/\(encoded)") {
            return url
        }
        return URL(string: "fitloop://today")!
    }
}

enum TodaySnapshotStore {
    private static let group = "68CTFST8W2.com.hejitech.fitloop.shared"
    private static let account = "todaySnapshot"

    private static var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccessGroup as String: group,
            kSecAttrService as String: "com.hejitech.fitloop",
            kSecAttrAccount as String: account,
        ]
    }

    static func load() -> TodaySnapshot? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return try? JSONDecoder().decode(TodaySnapshot.self, from: data)
    }

    static func save(_ snapshot: TodaySnapshot?) {
        guard let snapshot, let data = try? JSONEncoder().encode(snapshot) else {
            SecItemDelete(query as CFDictionary)
            return
        }
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        if SecItemUpdate(query as CFDictionary, attrs as CFDictionary) == errSecItemNotFound {
            SecItemAdd(query.merging(attrs) { $1 } as CFDictionary, nil)
        }
    }
}
