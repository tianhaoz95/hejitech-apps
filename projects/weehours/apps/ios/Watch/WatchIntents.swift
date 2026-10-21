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
        WatchRequest.shared.pending = .record
        return .result()
    }
}

/// Opens the watch app in tilt mode (TiltMode.swift), whichever mode the iPhone set it to open in.
struct TiltModeIntent: AppIntent {
    static let title: LocalizedStringResource = "Log by tilting"
    static let description = IntentDescription("Opens Wee Hours on Apple Watch in tilt mode: tilt your wrist toward feed, diaper, sleep or a care action.")
    static let openAppWhenRun = true
    @MainActor
    func perform() async throws -> some IntentResult {
        WatchRequest.shared.pending = .tilt
        return .result()
    }
}

/// Siri on the watch, the Shortcuts app and the Action Button on Apple Watch Ultra: speak, or tilt.
struct WeeHoursWatchShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: VoiceLogIntent(), phrases: ["Log by voice in \(.applicationName)"],
                    shortTitle: "Speak", systemImageName: "mic.fill")
        AppShortcut(intent: TiltModeIntent(), phrases: ["Log by tilting in \(.applicationName)", "Start tilt mode in \(.applicationName)"],
                    shortTitle: "Tilt", systemImageName: "gyroscope")
    }
}

/// What a shortcut asked the app to open into. Published state rather than a notification: on a
/// cold launch the intent runs before WatchRoot is on screen to hear one.
@MainActor
final class WatchRequest: ObservableObject {
    enum Kind { case record, tilt }
    static let shared = WatchRequest()
    @Published var pending: Kind?
}
