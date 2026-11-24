import ActivityKit
import AppIntents
import Foundation

/// Live Activity state for an active Roarly story on the Lock Screen and Dynamic Island.
/// Compiled into both the iPhone app (which starts, updates, and ends it) and the Live Activity
/// extension (which renders it).
struct StoryActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var modeTitle: String
        var isBedtime: Bool
        /// Active looping ambient sounds, formatted as "🌧️ Rain".
        var ambients: [String]
        var lastEmoji: String?
        var lastName: String?
    }

    var started: Date
}

/// Stops Roarly from listening from the Lock Screen or Dynamic Island.
struct StopStoryIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Stop listening"
    static let description = IntentDescription("Stops Roarly from listening and fades out all story sounds.")
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        await StoryIntentBridge.stopStory?()
        return .result()
    }
}

/// Fades out looping ambient sounds while continuing to listen.
struct SilenceAmbientsIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Silence background sounds"
    static let description = IntentDescription("Fades out looping background sounds while Roarly keeps listening.")
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        await StoryIntentBridge.silenceAmbients?()
        return .result()
    }
}

@MainActor
enum StoryIntentBridge {
    static var stopStory: (@MainActor () async -> Void)?
    static var silenceAmbients: (@MainActor () async -> Void)?
}
