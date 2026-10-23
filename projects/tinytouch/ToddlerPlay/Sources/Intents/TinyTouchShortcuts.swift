import AppIntents

/// App Shortcuts provider for watchOS: exposes voice commands to Siri, entries in the Shortcuts app,
/// Smart Stack launcher widgets, and the Action Button on watch hardware.
struct TinyTouchShortcuts: AppShortcutsProvider {
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
