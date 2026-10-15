import Foundation
import AppIntents

#if canImport(AppIntents)

/// App Intent to directly open Voxbrief and trigger audio capture.
/// Exposed to iOS for Action Button, Shortcuts, Siri, and system Control Center.
public struct StartCaptureIntent: AppIntent, AudioRecordingIntent {
    public static var title: LocalizedStringResource = "Start Capture"
    public static var description = IntentDescription("Opens Voxbrief and instantly begins recording a new voice note.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(
            name: .voxbriefNavigate,
            object: nil,
            userInfo: [
                "screen": "record",
                "source": "action_button"
            ]
        )
        return .result()
    }
}

/// App Intent for quick dictation memo capture.
public struct QuickMemoIntent: AppIntent, AudioRecordingIntent {
    public static var title: LocalizedStringResource = "Quick Memo"
    public static var description = IntentDescription("Opens Voxbrief ready to capture an instant audio memo.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(
            name: .voxbriefNavigate,
            object: nil,
            userInfo: [
                "screen": "record",
                "source": "quick_memo"
            ]
        )
        return .result()
    }
}

/// App Intent to open Voxbrief note vault.
public struct OpenVoxbriefIntent: AppIntent {
    public static var title: LocalizedStringResource = "Open Voxbrief"
    public static var description = IntentDescription("Opens your Voxbrief note vault.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(
            name: .voxbriefNavigate,
            object: nil,
            userInfo: [
                "screen": "list",
                "source": "action_button"
            ]
        )
        return .result()
    }
}

/// Registers App Shortcuts for Action Button, Siri voice triggering, and the Shortcuts app.
public struct VoxbriefShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartCaptureIntent(),
            phrases: [
                "Start capture in \(.applicationName)",
                "Record a voice note in \(.applicationName)",
                "Capture voice note in \(.applicationName)",
                "Record in \(.applicationName)"
            ],
            shortTitle: "Start Capture",
            systemImageName: "mic.fill"
        )
        AppShortcut(
            intent: QuickMemoIntent(),
            phrases: [
                "Quick memo in \(.applicationName)",
                "Instant dictation in \(.applicationName)"
            ],
            shortTitle: "Quick Memo",
            systemImageName: "waveform.badge.plus"
        )
        AppShortcut(
            intent: OpenVoxbriefIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Show my voice notes in \(.applicationName)"
            ],
            shortTitle: "Open Voxbrief",
            systemImageName: "waveform"
        )
    }
}

#endif
