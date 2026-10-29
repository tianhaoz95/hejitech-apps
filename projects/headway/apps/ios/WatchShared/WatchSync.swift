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
    public var hasCommute: Bool
    public var stations: [Station]
    public var expressPreference: ExpressPreference
    public var updatedAt: Double

    public init(
        session: AuthSession? = nil,
        board: Board? = nil,
        tracked: TrackedWithProgress? = nil,
        hasCommute: Bool = false,
        stations: [Station] = [],
        expressPreference: ExpressPreference = .all,
        updatedAt: Double = Date().timeIntervalSince1970
    ) {
        self.session = session
        self.board = board
        self.tracked = tracked
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
