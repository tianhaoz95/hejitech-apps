import AppIntents

/// Siri on the watch, the Shortcuts app and the Action Button on Apple Watch Ultra: speak, or tilt.
/// The intents themselves are in WatchShared/WatchLaunchIntents.swift.
struct WeeHoursWatchShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: VoiceLogIntent(), phrases: ["Log by voice in \(.applicationName)"],
                    shortTitle: "Speak", systemImageName: "mic.fill")
        AppShortcut(intent: TiltModeIntent(), phrases: ["Log by tilting in \(.applicationName)", "Start tilt mode in \(.applicationName)"],
                    shortTitle: "Tilt", systemImageName: "gyroscope")
    }
}
