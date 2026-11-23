import ActivityKit
import AppIntents
import Foundation

/// The workout on the Lock Screen and in the Dynamic Island while the player is open: the
/// exercise and set, the rest timer, heart rate, sets done. Compiled into the iPhone app (which
/// starts, updates and ends it) and the Live Activity extension (which draws it).
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var exercise: String
        var setLine: String
        var setsDone: Int
        var setsTotal: Int
        /// The rest timer's end (nil: not resting).
        var restUntil: Date?
        var heartRate: Int?
        /// The workout is over (shown briefly before the activity leaves).
        var finished: Bool = false
    }

    var title: String
    var started: Date
}

/// "Set done" on the Lock Screen and in the Dynamic Island. A LiveActivityIntent runs in the app's
/// process, where `WorkoutIntentBridge.setDone` is the open player's own set-done.
struct SetDoneIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Set done"
    static let description = IntentDescription("Checks off the current set of the workout that's open in FitLoop.")
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        await WorkoutIntentBridge.setDone?()
        return .result()
    }
}

@MainActor
enum WorkoutIntentBridge {
    /// Set by the app while a workout is open in the player.
    static var setDone: (@MainActor () async -> Void)?
}
