import AppIntents
import SwiftUI

/// AppEnum exposing the 5 toddler sensory play modes to iOS Shortcuts and Siri
enum GameModeAppEnum: String, AppEnum {
    case bubbles = "bubbles"
    case animals = "animals"
    case soundGarden = "soundGarden"
    case sparkles = "sparkles"
    case lullaby = "lullaby"

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Play Mode")
    
    static var caseDisplayRepresentations: [GameModeAppEnum: DisplayRepresentation] = [
        .bubbles: DisplayRepresentation(title: "Bubble Pop", subtitle: "Floating bubbles & pop sounds", image: .init(systemName: "bubbles.and.sparkles.fill")),
        .animals: DisplayRepresentation(title: "Animal Friends", subtitle: "Gentle peekaboo animal friends", image: .init(systemName: "pawprint.fill")),
        .soundGarden: DisplayRepresentation(title: "Sound Garden", subtitle: "Pentatonic harmonic chime bars", image: .init(systemName: "pianokeys.inverse")),
        .sparkles: DisplayRepresentation(title: "Magic Sparkles", subtitle: "Particle stardust canvas", image: .init(systemName: "sparkles")),
        .lullaby: DisplayRepresentation(title: "Sleepy Lullaby", subtitle: "Soothing wind-down music box", image: .init(systemName: "moon.stars.fill"))
    ]
}

/// Primary shortcut to launch TinyTouch on iPhone.
struct PlayTinyTouchIntent: AppIntent {
    static let title: LocalizedStringResource = "Play TinyTouch"
    static let description = IntentDescription("Opens TinyTouch on your device for safe toddler sensory play.")
    static let openAppWhenRun: Bool = true

    @Parameter(title: "Mode", description: "The sensory play mode to start")
    var mode: GameModeAppEnum?

    @MainActor
    func perform() async throws -> some IntentResult {
        return .result()
    }
}

/// Dedicated shortcut for Sleepy Lullaby mode.
struct PlayLullabyIntent: AppIntent {
    static let title: LocalizedStringResource = "Play Sleepy Lullaby"
    static let description = IntentDescription("Opens TinyTouch in soothing Sleepy Lullaby mode.")
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        return .result()
    }
}

/// App Shortcuts provider for iOS
struct TinyTouchIOSShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PlayTinyTouchIntent(),
            phrases: [
                "Play \(.applicationName)",
                "Start \(.applicationName)",
                "Launch \(.applicationName)",
                "Start playing in \(.applicationName)",
                "Play in \(.applicationName)"
            ],
            shortTitle: "Play",
            systemImageName: "face.smiling.fill"
        )
        AppShortcut(
            intent: PlayLullabyIntent(),
            phrases: [
                "Play lullaby in \(.applicationName)",
                "Start lullaby in \(.applicationName)"
            ],
            shortTitle: "Lullaby",
            systemImageName: "moon.stars.fill"
        )
    }
}
