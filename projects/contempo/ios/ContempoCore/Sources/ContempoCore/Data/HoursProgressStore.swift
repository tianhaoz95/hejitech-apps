import Foundation

/// Shared between the watch app (writer, whenever it refreshes its own
/// progress display) and its complication/widget extension (reader) via an
/// App Group — separate processes can't share plain `UserDefaults.standard`.
/// Foundation-only, no Firebase dependency, so this lives in the
/// platform-agnostic `ContempoCore` product alongside the rest of the
/// cross-target model code.
public struct HoursProgressStore: @unchecked Sendable {
    private static let hoursKey = "confirmed_hours"

    private let defaults: UserDefaults?

    public init(appGroupId: String) {
        self.defaults = UserDefaults(suiteName: appGroupId)
    }

    public func write(confirmedHours: Double) {
        defaults?.set(confirmedHours, forKey: Self.hoursKey)
    }

    public func read() -> Double {
        defaults?.double(forKey: Self.hoursKey) ?? 0
    }
}
