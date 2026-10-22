import AppIntents
import SwiftUI

// Compiled into the watch app and its widget extension: the app runs them (they open it), and
// the extension's Control and widgets need the types to point at them. The App Shortcuts provider
// stays in the app only (Watch/WatchIntents.swift): one provider per bundle.

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
    static let description = IntentDescription("Opens Wee Hours on your watch in tilt mode: tilt your wrist toward feed, diaper, sleep or a care action.")
    static let openAppWhenRun = true
    @MainActor
    func perform() async throws -> some IntentResult {
        WatchRequest.shared.pending = .tilt
        return .result()
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
