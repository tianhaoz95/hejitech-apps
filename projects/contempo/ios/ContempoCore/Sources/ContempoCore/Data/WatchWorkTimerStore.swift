import Foundation

public struct CompletedWorkTimer: Sendable, Equatable {
    public let startedAt: Date
    public let stoppedAt: Date
    public let durationMinutes: Int
    public let task: String
    public let property: String

    public init(startedAt: Date, stoppedAt: Date, durationMinutes: Int, task: String, property: String) {
        self.startedAt = startedAt
        self.stoppedAt = stoppedAt
        self.durationMinutes = durationMinutes
        self.task = task
        self.property = property
    }
}

/// Manages active work timer state for the watchOS companion app and watch complications.
/// Shared across the watch app and widget extension via App Group UserDefaults.
public struct WatchWorkTimerStore: @unchecked Sendable {
    private static let startTimeKey = "watch_active_timer_start_time"
    private static let taskKey = "watch_active_timer_task"
    private static let propertyKey = "watch_active_timer_property"

    private let defaults: UserDefaults?

    public init(appGroupId: String? = nil) {
        if let appGroupId, !appGroupId.isEmpty {
            self.defaults = UserDefaults(suiteName: appGroupId)
        } else {
            self.defaults = UserDefaults.standard
        }
    }

    public func startWorkTimer(task: String = "STR General Work", property: String = "") {
        let now = Date()
        defaults?.set(now.timeIntervalSince1970, forKey: Self.startTimeKey)
        defaults?.set(task, forKey: Self.taskKey)
        defaults?.set(property, forKey: Self.propertyKey)
    }

    public func isTimerRunning() -> Bool {
        guard let startTime = defaults?.double(forKey: Self.startTimeKey), startTime > 0 else {
            return false
        }
        return true
    }

    public func startedAt() -> Date? {
        guard let startTime = defaults?.double(forKey: Self.startTimeKey), startTime > 0 else {
            return nil
        }
        return Date(timeIntervalSince1970: startTime)
    }

    public func currentTask() -> String {
        defaults?.string(forKey: Self.taskKey) ?? "STR General Work"
    }

    public func currentProperty() -> String {
        defaults?.string(forKey: Self.propertyKey) ?? ""
    }

    public func elapsedSeconds(relativeTo now: Date = Date()) -> Int {
        guard let start = startedAt() else { return 0 }
        return max(0, Int(now.timeIntervalSince(start)))
    }

    public func elapsedMinutes(relativeTo now: Date = Date()) -> Int {
        return max(0, elapsedSeconds(relativeTo: now) / 60)
    }

    public func stopAndCompleteWorkTimer(stoppedAt: Date = Date()) -> CompletedWorkTimer? {
        guard let start = startedAt() else { return nil }
        let task = currentTask()
        let property = currentProperty()
        let seconds = max(0, Int(stoppedAt.timeIntervalSince(start)))
        // Cap minimum 1 min for non-zero timer sessions, cap max 12 hours
        let minutes = max(1, min(12 * 60, (seconds + 30) / 60))

        clearTimer()

        return CompletedWorkTimer(
            startedAt: start,
            stoppedAt: stoppedAt,
            durationMinutes: minutes,
            task: task,
            property: property
        )
    }

    public func clearTimer() {
        defaults?.removeObject(forKey: Self.startTimeKey)
        defaults?.removeObject(forKey: Self.taskKey)
        defaults?.removeObject(forKey: Self.propertyKey)
    }
}
