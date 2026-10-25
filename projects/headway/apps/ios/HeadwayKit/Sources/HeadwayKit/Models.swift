import Foundation

// Swift mirrors of @headway/core's JSON (packages/core/src/types.ts). The Worker computes every
// board; the app only shows them and edits settings.

public struct Station: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var short: String
}

public struct StationRef: Codable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var short: String
}

public enum TrainStatus: String, Codable, Sendable {
    case onTime = "on_time", late, early, cancelled, scheduled
}

public struct BoardTrain: Codable, Hashable, Identifiable, Sendable {
    public var tripId: String
    public var train: String
    public var kind: String
    public var dir: String
    public var serviceDate: String
    /// Epoch milliseconds.
    public var dep: Double
    public var arr: Double
    public var predDep: Double
    public var predArr: Double
    public var delayMin: Int?
    public var status: TrainStatus
    public var stopsBetween: Int

    public var id: String { "\(serviceDate):\(tripId)" }
    public var kindName: String { ["LOC": "Local", "LTD": "Limited", "EXP": "Express", "SCC": "South County"][kind] ?? kind }

    enum CodingKeys: String, CodingKey {
        case train, kind, dir, dep, arr, status
        case tripId = "trip_id", serviceDate = "service_date", predDep = "pred_dep", predArr = "pred_arr", delayMin = "delay_min", stopsBetween = "stops_between"
    }
}

public struct ServiceAlert: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var header: String
    public var description: String
    public var url: String?
}

public struct Board: Codable, Hashable, Sendable {
    public var from: StationRef
    public var to: StationRef
    public var leg: String
    public var generatedAt: Double
    public var live: Bool
    public var trains: [BoardTrain]
    public var alerts: [ServiceAlert]

    enum CodingKeys: String, CodingKey {
        case from, to, leg, live, trains, alerts
        case generatedAt = "generated_at"
    }
}

public struct Tracked: Codable, Hashable, Sendable {
    public var tripId: String
    public var serviceDate: String
    public var from: String
    public var to: String

    public init(tripId: String, serviceDate: String, from: String, to: String) {
        self.tripId = tripId
        self.serviceDate = serviceDate
        self.from = from
        self.to = to
    }

    enum CodingKeys: String, CodingKey {
        case from, to
        case tripId = "trip_id", serviceDate = "service_date"
    }
}

public struct NextStop: Codable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var short: String
    public var pred: Double
}

public struct TrainProgress: Codable, Hashable, Sendable {
    public var tripId: String
    public var train: String
    public var kind: String
    public var serviceDate: String
    public var to: StationRef
    public var next: NextStop?
    public var predArr: Double
    public var arr: Double
    public var delayMin: Int?
    public var stopsLeft: Int
    public var cancelled: Bool
    public var arrived: Bool
    public var live: Bool

    enum CodingKeys: String, CodingKey {
        case train, kind, to, next, arr, cancelled, arrived, live
        case tripId = "trip_id", serviceDate = "service_date", predArr = "pred_arr", delayMin = "delay_min", stopsLeft = "stops_left"
    }
}

public struct TrackedWithProgress: Codable, Hashable, Sendable {
    public var tripId: String
    public var serviceDate: String
    public var from: String
    public var to: String
    public var progress: TrainProgress

    enum CodingKeys: String, CodingKey {
        case from, to, progress
        case tripId = "trip_id", serviceDate = "service_date"
    }
}

public struct MyBoard: Codable, Sendable {
    public var board: Board?
    public var hasCommute: Bool
    public var saved: Bool
    public var tracked: TrackedWithProgress?

    enum CodingKeys: String, CodingKey {
        case board, saved, tracked
        case hasCommute = "has_commute"
    }
}

// MARK: - settings

public struct TimeWindow: Codable, Hashable, Sendable {
    public var start: String
    public var end: String
    public init(start: String, end: String) { self.start = start; self.end = end }
}

public struct Leg: Codable, Hashable, Sendable {
    public var from: String
    public var to: String
    public var walkMinutes: Int
    /// "HH:MM": the first train at or after it gets the leave-now reminder.
    public var usual: String?
    public var window: TimeWindow

    public init(from: String, to: String, walkMinutes: Int = 10, usual: String? = nil, window: TimeWindow) {
        self.from = from
        self.to = to
        self.walkMinutes = walkMinutes
        self.usual = usual
        self.window = window
    }

    public static func morning(from: String, to: String) -> Leg { Leg(from: from, to: to, window: TimeWindow(start: "06:00", end: "10:30")) }
    public static func evening(from: String, to: String) -> Leg { Leg(from: from, to: to, window: TimeWindow(start: "15:30", end: "20:00")) }

    enum CodingKeys: String, CodingKey {
        case from, to, usual, window
        case walkMinutes = "walk_minutes"
    }

    // `usual` is always sent (null clears it).
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(from, forKey: .from)
        try c.encode(to, forKey: .to)
        try c.encode(walkMinutes, forKey: .walkMinutes)
        try c.encode(usual, forKey: .usual)
        try c.encode(window, forKey: .window)
    }
}

public struct AlertSettings: Codable, Hashable, Sendable {
    public var delay: Bool
    public var delayThreshold: Int
    public var cancellation: Bool
    public var service: Bool
    public var leaveNow: Bool
    public var arrival: Bool
    public var arrivalMinutes: Int

    enum CodingKeys: String, CodingKey {
        case delay, cancellation, service, arrival
        case delayThreshold = "delay_threshold", leaveNow = "leave_now", arrivalMinutes = "arrival_minutes"
    }
}

public struct Settings: Codable, Hashable, Sendable {
    public var morning: Leg?
    public var evening: Leg?
    public var switchAt: String
    /// 0 = Monday … 6 = Sunday.
    public var days: [Int]
    public var alerts: AlertSettings

    enum CodingKeys: String, CodingKey {
        case morning, evening, days, alerts
        case switchAt = "switch_at"
    }

    public static let defaults = Settings(
        morning: nil, evening: nil, switchAt: "12:00", days: [0, 1, 2, 3, 4],
        alerts: AlertSettings(delay: true, delayThreshold: 5, cancellation: true, service: true, leaveNow: true, arrival: true, arrivalMinutes: 5))

    // Legs are always sent (null clears one).
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(morning, forKey: .morning)
        try c.encode(evening, forKey: .evening)
        try c.encode(switchAt, forKey: .switchAt)
        try c.encode(days, forKey: .days)
        try c.encode(alerts, forKey: .alerts)
    }
}

public struct SettingsResponse: Codable, Sendable {
    public var settings: Settings
    public var saved: Bool
    public var email: String?
}

public struct PairingCode: Codable, Sendable {
    public var code: String
    public var expiresAt: String
    enum CodingKeys: String, CodingKey { case code; case expiresAt = "expires_at" }
}

public struct PairedDevice: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var label: String
    public var createdAt: String
    public var lastUsedAt: String?
    enum CodingKeys: String, CodingKey { case id, label; case createdAt = "created_at"; case lastUsedAt = "last_used_at" }
}

// MARK: - time

public enum Clock {
    public static let pacific = TimeZone(identifier: "America/Los_Angeles")!

    /// "8:14" in Pacific time.
    public static func time(_ epochMs: Double) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = pacific
        f.dateFormat = "h:mm"
        return f.string(from: Date(timeIntervalSince1970: epochMs / 1000))
    }

    /// "12m", "now", "1h05".
    public static func until(_ epochMs: Double, now: Date = Date()) -> String {
        let m = Int(floor((epochMs / 1000 - now.timeIntervalSince1970) / 60))
        if m <= 0 { return "now" }
        if m < 100 { return "\(m)m" }
        return "\(m / 60)h\(String(format: "%02d", m % 60))"
    }

    /// "HH:MM" ↔ minutes.
    public static func minutes(_ hhmm: String) -> Int? {
        let p = hhmm.split(separator: ":").compactMap { Int($0) }
        guard p.count == 2, (0..<24).contains(p[0]), (0..<60).contains(p[1]) else { return nil }
        return p[0] * 60 + p[1]
    }

    public static func hhmm(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }
}
