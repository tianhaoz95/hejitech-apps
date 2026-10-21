import AppIntents
import SwiftUI

/// Shortcuts on Apple Watch run only intents the watch app itself has: the iPhone's "Speak a log
/// entry" (`VoiceLogIntent` in App/Sources/App.swift) has nothing to launch here, so running it
/// from the watch failed. This is the same intent (same type name and title, so a shortcut made on
/// the iPhone resolves to it) and opens the watch app already recording, like the complication.
struct VoiceLogIntent: AppIntent {
    static let title: LocalizedStringResource = "Speak a log entry"
    static let openAppWhenRun = true
    @MainActor
    func perform() async throws -> some IntentResult {
        RecordRequest.shared.pending = true
        return .result()
    }
}

/// Siri on the watch, the Shortcuts app and the Action Button on Apple Watch Ultra.
struct WeeHoursWatchShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: VoiceLogIntent(), phrases: ["Log by voice in \(.applicationName)"],
                    shortTitle: "Speak", systemImageName: "mic.fill")
    }
}

/// A shortcut asked to record. A flag rather than a notification: on a cold launch the intent
/// runs before WatchRoot is on screen to hear one.
@MainActor
final class RecordRequest: ObservableObject {
    static let shared = RecordRequest()
    @Published var pending = false
}
