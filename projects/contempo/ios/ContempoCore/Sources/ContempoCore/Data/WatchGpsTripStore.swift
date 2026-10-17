import Foundation

public struct CompletedGpsTrip: Sendable, Equatable {
    public let startedAt: Date
    public let stoppedAt: Date
    public let durationMinutes: Int

    public init(startedAt: Date, stoppedAt: Date, durationMinutes: Int) {
        self.startedAt = startedAt
        self.stoppedAt = stoppedAt
        self.durationMinutes = durationMinutes
    }
}

/// Manages active GPS trip state for the watchOS companion app and watch complications.
/// Shared across the watch app and widget extension via App Group UserDefaults.
public struct WatchGpsTripStore: @unchecked Sendable {
    private static let startTimeKey = "gps_trip_start_time"
    private static let activeKey = "gps_trip_active"

    private let defaults: UserDefaults?

    public init(appGroupId: String? = nil) {
        if let appGroupId, !appGroupId.isEmpty {
            self.defaults = UserDefaults(suiteName: appGroupId)
        } else {
            self.defaults = UserDefaults.standard
        }
    }

    public func startGpsTrip() {
        let now = Date()
        defaults?.set(now.timeIntervalSince1970, forKey: Self.startTimeKey)
        defaults?.set(true, forKey: Self.activeKey)
    }

    public func isTripActive() -> Bool {
        guard let startTime = defaults?.double(forKey: Self.startTimeKey), startTime > 0 else {
            return false
        }
        return defaults?.bool(forKey: Self.activeKey) ?? false
    }

    public func startedAt() -> Date? {
        guard let startTime = defaults?.double(forKey: Self.startTimeKey), startTime > 0 else {
            return nil
        }
        return Date(timeIntervalSince1970: startTime)
    }

    public func elapsedSeconds(relativeTo now: Date = Date()) -> Int {
        guard let start = startedAt() else { return 0 }
        return max(0, Int(now.timeIntervalSince(start)))
    }

    public func elapsedMinutes(relativeTo now: Date = Date()) -> Int {
        return max(0, elapsedSeconds(relativeTo: now) / 60)
    }

    public func stopAndCompleteGpsTrip(stoppedAt: Date = Date()) -> CompletedGpsTrip? {
        guard let start = startedAt() else { return nil }
        let seconds = max(0, Int(stoppedAt.timeIntervalSince(start)))
        let minutes = max(1, min(12 * 60, (seconds + 30) / 60))

        clearTrip()

        return CompletedGpsTrip(
            startedAt: start,
            stoppedAt: stoppedAt,
            durationMinutes: minutes
        )
    }

    public func clearTrip() {
        defaults?.removeObject(forKey: Self.startTimeKey)
        defaults?.set(false, forKey: Self.activeKey)
    }
}
