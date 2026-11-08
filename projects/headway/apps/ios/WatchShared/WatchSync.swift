import Foundation
import HeadwayKit

/// What the iPhone and Apple Watch say to each other over WatchConnectivity.
public enum WatchMessage {
    // Application context / message keys
    public static let kind = "kind"
    public static let stateData = "stateData"

    // Action kinds (watch → phone)
    public static let kindTrack = "track"
    public static let kindUntrack = "untrack"
    public static let kindFlip = "flip"
    public static let kindRefresh = "refresh"
    public static let kindSelectStations = "selectStations"
    public static let kindFilterExpress = "filterExpress"

    // Payload fields
    public static let tripId = "tripId"
    public static let serviceDate = "serviceDate"
    public static let fromStation = "from"
    public static let toStation = "to"
    public static let expressPref = "expressPref"
}

/// The state snapshot synced between the iPhone and the Apple Watch.
public struct WatchSyncState: Codable, Sendable {
    public var session: AuthSession?
    public var board: Board?
    public var tracked: TrackedWithProgress?
    public var onTrain: OnTrainCard?
    public var hasCommute: Bool
    public var stations: [Station]
    public var expressPreference: ExpressPreference
    public var updatedAt: Double

    public init(
        session: AuthSession? = nil,
        board: Board? = nil,
        tracked: TrackedWithProgress? = nil,
        onTrain: OnTrainCard? = nil,
        hasCommute: Bool = false,
        stations: [Station] = [],
        expressPreference: ExpressPreference = .all,
        updatedAt: Double = Date().timeIntervalSince1970
    ) {
        self.session = session
        self.board = board
        self.tracked = tracked
        self.onTrain = onTrain
        self.hasCommute = hasCommute
        self.stations = stations
        self.expressPreference = expressPreference
        self.updatedAt = updatedAt
    }

    public static func decode(from data: Data) -> WatchSyncState? {
        try? JSONDecoder().decode(WatchSyncState.self, from: data)
    }

    public func encode() -> Data? {
        try? JSONEncoder().encode(self)
    }
}

/// Shared cache storage for the watch app and its watch face complications.
public enum WatchStore {
    public static let sharedSuiteName = "group.com.hejitech.headway"
    public static let cachedStateKey = "watch_cached_state"

    public static var defaults: UserDefaults {
        UserDefaults(suiteName: sharedSuiteName) ?? .standard
    }

    public static func loadCachedState() -> WatchSyncState? {
        if let data = defaults.data(forKey: cachedStateKey),
           let state = WatchSyncState.decode(from: data) {
            return state
        }
        if let data = UserDefaults.standard.data(forKey: cachedStateKey),
           let state = WatchSyncState.decode(from: data) {
            return state
        }
        return nil
    }

    public static func saveCachedState(_ state: WatchSyncState) {
        if let data = state.encode() {
            defaults.set(data, forKey: cachedStateKey)
            UserDefaults.standard.set(data, forKey: cachedStateKey)
        }
    }
}

/// A pair the rider chose on the watch (flip) instead of the commute leg for the time of day.
/// Without one, the watch and its complication ask the Worker for "my board" with no stations, so
/// the morning/evening switch happens on its own. A pick lasts `lifetime`, then the commute is back.
public struct ManualPick: Codable, Sendable, Equatable {
    public var from: String
    public var to: String
    public var setAt: Double

    public static let lifetime: TimeInterval = 2 * 60 * 60

    public init(from: String, to: String, setAt: Double = Date().timeIntervalSince1970) {
        self.from = from
        self.to = to
        self.setAt = setAt
    }

    public func isCurrent(at now: Date = Date()) -> Bool {
        now.timeIntervalSince1970 - setAt < Self.lifetime
    }
}

extension WatchStore {
    public static let manualPickKey = "watch_manual_pick"

    /// The rider's current pick, or nil (none, or it expired).
    public static func loadManualPick(at now: Date = Date()) -> ManualPick? {
        guard let data = defaults.data(forKey: manualPickKey),
              let pick = try? JSONDecoder().decode(ManualPick.self, from: data),
              pick.isCurrent(at: now) else { return nil }
        return pick
    }

    public static func saveManualPick(_ pick: ManualPick?) {
        if let pick, let data = try? JSONEncoder().encode(pick) {
            defaults.set(data, forKey: manualPickKey)
        } else {
            defaults.removeObject(forKey: manualPickKey)
        }
    }

    /// The stations to ask for. Signed in, nil unless the rider picked a pair, so the Worker
    /// chooses the commute leg for now; signed out (public board), the last board's pair.
    public static func boardQuery(signedIn: Bool, board: Board?, at now: Date = Date()) -> (from: String, to: String)? {
        if let pick = loadManualPick(at: now) { return (pick.from, pick.to) }
        if signedIn { return nil }
        return board.map { ($0.from.id, $0.to.id) }
    }
}
