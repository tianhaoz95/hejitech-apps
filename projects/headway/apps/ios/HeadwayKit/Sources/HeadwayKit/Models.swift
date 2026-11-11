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

public enum ExpressPreference: String, Codable, CaseIterable, Sendable {
    case all
    case preferExpress = "prefer_express"
    case expressOnly = "express_only"

    public var title: String {
        switch self {
        case .all: return "All trains"
        case .preferExpress: return "Prefer express"
        case .expressOnly: return "Express only"
        }
    }
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
    /// Epoch milliseconds when rider must leave (predDep - walk).
    public var leaveBy: Double?
    /// Catch state: "later", "leave", "run", "missed".
    public var catchState: String?
    /// With a travel estimate: minutes to spare if leaving now (negative: too late by that much).
    public var bufferMin: Int?
    /// Ride duration in minutes: (predArr - predDep) / 60_000.
    public var rideMin: Int?
    /// Trip id of a later-departing train that arrives sooner, if overtaken.
    public var overtakenBy: String?
    /// Train number of the overtaker (e.g. "511"), if overtaken.
    public var overtakenByTrain: String?
    /// True if this train is the earliest predicted arrival among visible trains.
    public var firstIn: Bool?
    /// True if this train has the shortest ride among visible non-cancelled trains.
    public var shortest: Bool?
    /// Its time at your station has passed; it stays listed for a few minutes because real trains run late.
    public var pastDue: Bool?

    public var id: String { "\(serviceDate):\(tripId)" }

    /// What to say about a train past its time: right after it, it's probably just arriving.
    public func dueLabel(now: Date) -> String {
        now.timeIntervalSince1970 * 1000 - max(dep, predDep) < 120_000 ? "Due" : "May have left"
    }
    public var kindName: String { ["LOC": "Local", "LTD": "Limited", "EXP": "Express", "SCC": "South County"][kind] ?? kind }
    public var isExpress: Bool { kind == "EXP" }

    public init(
        tripId: String = "",
        train: String,
        kind: String = "EXP",
        dir: String = "NB",
        serviceDate: String = "",
        dep: Double,
        arr: Double,
        predDep: Double,
        predArr: Double,
        delayMin: Int? = nil,
        status: TrainStatus = .onTime,
        stopsBetween: Int = 0,
        leaveBy: Double? = nil,
        catchState: String? = nil,
        rideMin: Int? = nil,
        overtakenBy: String? = nil,
        overtakenByTrain: String? = nil,
        firstIn: Bool? = nil,
        shortest: Bool? = nil,
        bufferMin: Int? = nil,
        pastDue: Bool? = nil
    ) {
        self.tripId = tripId
        self.train = train
        self.kind = kind
        self.dir = dir
        self.serviceDate = serviceDate
        self.dep = dep
        self.arr = arr
        self.predDep = predDep
        self.predArr = predArr
        self.delayMin = delayMin
        self.status = status
        self.stopsBetween = stopsBetween
        self.leaveBy = leaveBy
        self.catchState = catchState
        self.rideMin = rideMin
        self.overtakenBy = overtakenBy
        self.overtakenByTrain = overtakenByTrain
        self.firstIn = firstIn
        self.shortest = shortest
        self.bufferMin = bufferMin
        self.pastDue = pastDue
    }

    enum CodingKeys: String, CodingKey {
        case train, kind, dir, dep, arr, status
        case tripId = "trip_id", serviceDate = "service_date", predDep = "pred_dep", predArr = "pred_arr", delayMin = "delay_min", stopsBetween = "stops_between"
        case leaveBy = "leave_by", catchState = "catch"
        case rideMin = "ride_min", overtakenBy = "overtaken_by", overtakenByTrain = "overtaken_by_train", firstIn = "first_in", shortest
        case bufferMin = "buffer_min", pastDue = "past_due"
    }
}

public struct ServiceAlert: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var header: String
    public var description: String
    public var url: String?
}

public struct BoardTip: Codable, Hashable, Sendable {
    public var waitFor: String
    public var waitForKind: String
    public var waitForDep: Double
    public var waitForArr: Double
    public var insteadOf: String
    public var insteadOfArr: Double
    public var savesMin: Int

    enum CodingKeys: String, CodingKey {
        case waitFor = "wait_for"
        case waitForKind = "wait_for_kind"
        case waitForDep = "wait_for_dep"
        case waitForArr = "wait_for_arr"
        case insteadOf = "instead_of"
        case insteadOfArr = "instead_of_arr"
        case savesMin = "saves_min"
    }
}

public struct Board: Codable, Hashable, Sendable {
    public var from: StationRef
    public var to: StationRef
    public var leg: String
    public var generatedAt: Double
    public var live: Bool
    public var trains: [BoardTrain]
    public var alerts: [ServiceAlert]
    public var expressPreference: String?
    public var walkMinutes: Int?
    public var tip: BoardTip?
    /// Set when the board was asked from the rider's location: walkMinutes is then this estimate.
    public var travel: TravelEstimate?

    enum CodingKeys: String, CodingKey {
        case from, to, leg, live, trains, alerts, tip, travel
        case generatedAt = "generated_at"
        case expressPreference = "express_preference"
        case walkMinutes = "walk_minutes"
    }
}

/// How the rider gets to the station. Mirrors core's `TravelMode`; an unknown value (from a newer
/// Worker) decodes as `.walk` so a board never fails to load over it.
public enum TravelMode: String, Codable, CaseIterable, Sendable {
    case walk, bike, ebike, scooter, drive

    public init(from decoder: Decoder) throws {
        self = TravelMode(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .walk
    }

    public var title: String {
        switch self {
        case .walk: "Walk"
        case .bike: "Bike"
        case .ebike: "E-bike"
        case .scooter: "E-scooter"
        case .drive: "Drive"
        }
    }
    /// "~8 min <verb> to MV".
    public var verb: String {
        switch self {
        case .walk: "walk"
        case .bike: "bike ride"
        case .ebike: "e-bike ride"
        case .scooter: "scooter ride"
        case .drive: "drive"
        }
    }
    public var symbol: String {
        switch self {
        case .walk: "figure.walk"
        case .bike: "bicycle"
        case .ebike: "bicycle"
        case .scooter: "scooter"
        case .drive: "car.fill"
        }
    }
}

/// A rough door-to-platform estimate from the rider's location (straight line × detour ÷ average speed).
public struct TravelEstimate: Codable, Hashable, Sendable {
    public var mode: TravelMode
    public var distanceM: Int
    public var minutes: Int

    enum CodingKeys: String, CodingKey {
        case mode, minutes
        case distanceM = "distance_m"
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
    /// The train has left the station they track it from (absent from older servers).
    public var departed: Bool?
    public var live: Bool

    /// On the train: it left their station and hasn't arrived.
    public var riding: Bool { departed == true && !arrived && !cancelled }

    enum CodingKeys: String, CodingKey {
        case train, kind, to, next, arr, cancelled, arrived, departed, live
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
    public var onTrain: OnTrainCard?
    /// The leg you finished today, while its alerts are held back.
    public var commuteDone: CommuteDoneCard?

    enum CodingKeys: String, CodingKey {
        case board, saved, tracked
        case hasCommute = "has_commute", onTrain = "on_train", commuteDone = "commute_done"
    }
}

/// Your location showed you reached a leg's destination: no more alerts for it today.
public struct CommuteDoneCard: Codable, Hashable, Sendable {
    /// "morning" or "evening".
    public var part: String
    public var to: StationRef
    /// When you got there, epoch ms.
    public var at: Double
    /// The end of the leg's watch window, epoch ms.
    public var until: Double
}

/// One location fix sent to tell which train you're on. Used for that answer and never stored.
public struct OnTrainSample: Codable, Hashable, Sendable {
    public var lat: Double
    public var lon: Double
    /// Epoch milliseconds.
    public var at: Double
    /// Metres per second; absent when the phone doesn't know.
    public var speed: Double?
    public init(lat: Double, lon: Double, at: Double, speed: Double?) {
        self.lat = lat; self.lon = lon; self.at = at; self.speed = speed
    }
}

public struct OnTrainStop: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var short: String
    public var pred: Double
    /// done, now or upcoming.
    public var status: String
}

/// What someone riding a train wants to see instead of when to leave for it.
public struct OnTrainCard: Codable, Hashable, Sendable {
    public var tripId: String
    public var serviceDate: String
    /// high, or low: "looks like", and Headway won't start tracking by itself.
    public var confidence: String
    public var train: String
    public var kind: String
    public var dir: String
    public var from: StationRef
    public var to: StationRef
    /// commute, tracked or terminal (no commute matches: the end of the line).
    public var toSource: String
    public var next: NextStop?
    public var predArr: Double
    public var arr: Double
    public var delayMin: Int?
    public var stopsLeft: Int
    public var stops: [OnTrainStop]
    public var alerts: [ServiceAlert]
    public var tracked: Bool
    public var live: Bool

    public var kindName: String { ["LOC": "Local", "LTD": "Limited", "EXP": "Express", "SCC": "South County"][kind] ?? kind }
    public var isSure: Bool { confidence == "high" }

    enum CodingKeys: String, CodingKey {
        case confidence, train, kind, dir, from, to, next, arr, stops, alerts, tracked, live
        case tripId = "trip_id", serviceDate = "service_date", toSource = "to_source", predArr = "pred_arr", delayMin = "delay_min", stopsLeft = "stops_left"
    }
}

public struct OnTrainReport: Codable, Sendable {
    public var onTrain: OnTrainCard?
    public var autoTracked: Bool
    enum CodingKeys: String, CodingKey { case onTrain = "on_train", autoTracked = "auto_tracked" }
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
    public var expressPreference: ExpressPreference
    /// How the rider gets to `from`: with their location, the board estimates the trip instead of walkMinutes.
    public var travelMode: TravelMode

    public init(from: String, to: String, walkMinutes: Int = 10, usual: String? = nil, window: TimeWindow, expressPreference: ExpressPreference = .all, travelMode: TravelMode = .walk) {
        self.from = from
        self.to = to
        self.walkMinutes = walkMinutes
        self.usual = usual
        self.window = window
        self.expressPreference = expressPreference
        self.travelMode = travelMode
    }

    public static func morning(from: String, to: String) -> Leg { Leg(from: from, to: to, window: TimeWindow(start: "06:00", end: "10:30")) }
    public static func evening(from: String, to: String) -> Leg { Leg(from: from, to: to, window: TimeWindow(start: "15:30", end: "20:00")) }

    enum CodingKeys: String, CodingKey {
        case from, to, usual, window
        case walkMinutes = "walk_minutes"
        case expressPreference = "express_preference"
        case travelMode = "travel_mode"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        from = try c.decode(String.self, forKey: .from)
        to = try c.decode(String.self, forKey: .to)
        walkMinutes = try c.decode(Int.self, forKey: .walkMinutes)
        usual = try c.decodeIfPresent(String.self, forKey: .usual)
        window = try c.decode(TimeWindow.self, forKey: .window)
        expressPreference = (try? c.decodeIfPresent(ExpressPreference.self, forKey: .expressPreference)) ?? .all
        travelMode = (try? c.decodeIfPresent(TravelMode.self, forKey: .travelMode)) ?? .walk
    }

    // `usual` is always sent (null clears it).
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(from, forKey: .from)
        try c.encode(to, forKey: .to)
        try c.encode(walkMinutes, forKey: .walkMinutes)
        try c.encode(usual, forKey: .usual)
        try c.encode(window, forKey: .window)
        try c.encode(expressPreference, forKey: .expressPreference)
        try c.encode(travelMode, forKey: .travelMode)
    }
}

/// Which notifications to send. Priority affects your commute; `all` adds the rest, quietly.
public enum AlertScope: String, Codable, CaseIterable, Sendable {
    case priority, all
    public var title: String { self == .priority ? "Priority only" : "Priority and quiet" }
}

/// What Headway does when your location shows you're on a train.
public enum OnTrainMode: String, Codable, CaseIterable, Sendable {
    case off, card, auto, background
    public var title: String {
        switch self {
        case .off: "Off"
        case .card: "Show the card"
        case .auto: "Also start tracking"
        case .background: "Also with the app closed"
        }
    }
    public var usesLocation: Bool { self != .off }
    public var startsTracking: Bool { self == .auto || self == .background }
}

public struct AlertSettings: Codable, Hashable, Sendable {
    public var delay: Bool
    public var delayThreshold: Int
    public var cancellation: Bool
    public var service: Bool
    public var leaveNow: Bool
    public var arrival: Bool
    public var arrivalMinutes: Int
    public var betterTrain: Bool
    public var scope: AlertScope = .priority
    /// Once your location shows you reached a leg's destination, stop that leg's alerts for the day.
    public var stopWhenDone: Bool = true

    public init(delay: Bool = true, delayThreshold: Int = 5, cancellation: Bool = true, service: Bool = true, leaveNow: Bool = true, arrival: Bool = true, arrivalMinutes: Int = 5, betterTrain: Bool = true) {
        self.delay = delay
        self.delayThreshold = delayThreshold
        self.cancellation = cancellation
        self.service = service
        self.leaveNow = leaveNow
        self.arrival = arrival
        self.arrivalMinutes = arrivalMinutes
        self.betterTrain = betterTrain
    }

    enum CodingKeys: String, CodingKey {
        case delay, cancellation, service, arrival, scope
        case delayThreshold = "delay_threshold", leaveNow = "leave_now", arrivalMinutes = "arrival_minutes", betterTrain = "better_train", stopWhenDone = "stop_when_done"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        delay = try c.decode(Bool.self, forKey: .delay)
        delayThreshold = try c.decode(Int.self, forKey: .delayThreshold)
        cancellation = try c.decode(Bool.self, forKey: .cancellation)
        service = try c.decode(Bool.self, forKey: .service)
        leaveNow = try c.decode(Bool.self, forKey: .leaveNow)
        arrival = try c.decode(Bool.self, forKey: .arrival)
        arrivalMinutes = try c.decode(Int.self, forKey: .arrivalMinutes)
        betterTrain = (try? c.decodeIfPresent(Bool.self, forKey: .betterTrain)) ?? true
        scope = (try? c.decodeIfPresent(AlertScope.self, forKey: .scope)) ?? .priority
        stopWhenDone = (try? c.decodeIfPresent(Bool.self, forKey: .stopWhenDone)) ?? true
    }
}

public struct Settings: Codable, Hashable, Sendable {
    public var morning: Leg?
    public var evening: Leg?
    public var switchAt: String
    /// 0 = Monday … 6 = Sunday.
    public var days: [Int]
    public var alerts: AlertSettings
    public var expressPreference: ExpressPreference
    public var shareName: String?
    public var onTrain: OnTrainMode = .card

    enum CodingKeys: String, CodingKey {
        case morning, evening, days, alerts
        case onTrain = "on_train"
        case switchAt = "switch_at"
        case expressPreference = "express_preference"
        case shareName = "share_name"
    }

    public init(morning: Leg?, evening: Leg?, switchAt: String, days: [Int], alerts: AlertSettings, expressPreference: ExpressPreference = .all, shareName: String? = nil) {
        self.morning = morning
        self.evening = evening
        self.switchAt = switchAt
        self.days = days
        self.alerts = alerts
        self.expressPreference = expressPreference
        self.shareName = shareName
    }

    public static let defaults = Settings(
        morning: nil, evening: nil, switchAt: "12:00", days: [0, 1, 2, 3, 4],
        alerts: AlertSettings(delay: true, delayThreshold: 5, cancellation: true, service: true, leaveNow: true, arrival: true, arrivalMinutes: 5, betterTrain: true),
        expressPreference: .all,
        shareName: nil)

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        morning = try c.decodeIfPresent(Leg.self, forKey: .morning)
        evening = try c.decodeIfPresent(Leg.self, forKey: .evening)
        switchAt = try c.decode(String.self, forKey: .switchAt)
        days = try c.decode([Int].self, forKey: .days)
        alerts = try c.decode(AlertSettings.self, forKey: .alerts)
        expressPreference = (try? c.decodeIfPresent(ExpressPreference.self, forKey: .expressPreference)) ?? .all
        shareName = try c.decodeIfPresent(String.self, forKey: .shareName)
        onTrain = (try? c.decodeIfPresent(OnTrainMode.self, forKey: .onTrain)) ?? .card
    }

    // Legs are always sent (null clears one).
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(morning, forKey: .morning)
        try c.encode(evening, forKey: .evening)
        try c.encode(switchAt, forKey: .switchAt)
        try c.encode(days, forKey: .days)
        try c.encode(alerts, forKey: .alerts)
        try c.encode(expressPreference, forKey: .expressPreference)
        try c.encode(shareName, forKey: .shareName)
        try c.encode(onTrain, forKey: .onTrain)
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

public struct EtaShareResponse: Codable, Hashable, Sendable {
    public var token: String
    public var url: String
    public var expiresAt: String

    public init(token: String, url: String, expiresAt: String) {
        self.token = token
        self.url = url
        self.expiresAt = expiresAt
    }

    enum CodingKeys: String, CodingKey {
        case token, url
        case expiresAt = "expires_at"
    }
}

// MARK: - time

public enum Clock {
    public static let pacific = TimeZone(identifier: "America/Los_Angeles")!

    /// Seconds added to the device clock. Always 0 in production; a Debug build on the local stack copies the
    /// local Worker's demo clock (GET /api/dev/clock), so the app can be tested and recorded against any
    /// moment's schedule (a weekday rush on a Sunday night).
    nonisolated(unsafe) public static var offset: TimeInterval = 0

    /// Now, on the app's clock (the device's, plus `offset`).
    public static func now() -> Date { Date().addingTimeInterval(offset) }

    /// "8:14" in Pacific time.
    public static func time(_ epochMs: Double) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = pacific
        f.dateFormat = "h:mm"
        return f.string(from: Date(timeIntervalSince1970: epochMs / 1000))
    }

    /// "12m", "now", "1h05".
    public static func until(_ epochMs: Double, now: Date = Clock.now()) -> String {
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

/// GET /api/dev/clock on the local stack: the Worker's demo clock.
public struct DevClock: Decodable, Sendable {
    public let offsetMs: Double
    enum CodingKeys: String, CodingKey { case offsetMs = "offset_ms" }
}
