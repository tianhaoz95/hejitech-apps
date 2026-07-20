import Foundation
import Observation

public struct QuickCaptureStatusUiState: Sendable {
    public let pendingCount: Int
    public let completedTodayCount: Int
    public let processingStage: AudioProcessingStage?

    public init(pendingCount: Int, completedTodayCount: Int, processingStage: AudioProcessingStage?) {
        self.pendingCount = pendingCount
        self.completedTodayCount = completedTodayCount
        self.processingStage = processingStage
    }

    public var hasAnything: Bool {
        pendingCount > 0 || completedTodayCount > 0 || processingStage != nil
    }
}

/// Persisted daily completion counter for Quick Capture recordings — shown on
/// the Capture tab's status indicator alongside live pending/processing counts.
@Observable
@MainActor
public final class QuickCaptureStatsStore {
    private static let keyDate = "quick_capture_stats_date"
    private static let keyCount = "quick_capture_stats_count"
    private let defaults: UserDefaults

    public private(set) var completedTodayCount: Int = 0

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.completedTodayCount = loadTodayCount()
    }

    public func recordCompleted() {
        let today = todayString()
        let storedDate = defaults.string(forKey: Self.keyDate)
        let newCount = (storedDate == today) ? (defaults.integer(forKey: Self.keyCount) + 1) : 1

        defaults.set(today, forKey: Self.keyDate)
        defaults.set(newCount, forKey: Self.keyCount)
        self.completedTodayCount = newCount
    }

    private func loadTodayCount() -> Int {
        let today = todayString()
        let storedDate = defaults.string(forKey: Self.keyDate)
        if storedDate == today {
            return defaults.integer(forKey: Self.keyCount)
        }
        return 0
    }

    private func todayString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        return formatter.string(from: Date())
    }
}
