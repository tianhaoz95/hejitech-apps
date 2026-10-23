import AppIntents
import SwiftUI

/// App Intent to open the ToddlerCam parent remote on watchOS.
/// Exposed to watchOS Shortcuts app, Action Button, and Siri.
public struct OpenToddlerCamIntent: AppIntent {
    public static var title: LocalizedStringResource = "Open ToddlerCam Remote"
    public static var description = IntentDescription("Opens the ToddlerCam parent remote on your watch.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        WatchRequest.shared.pendingAction = .remote
        return .result()
    }
}

/// App Intent to take a photo using ToddlerCam parent remote on watchOS.
/// Launches the watch app and sends the shutter trigger command to the phone.
public struct TakeRemotePhotoIntent: AppIntent {
    public static var title: LocalizedStringResource = "Take Photo"
    public static var description = IntentDescription("Takes a photo using ToddlerCam parent remote on your watch.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        WatchRequest.shared.pendingAction = .shutter
        return .result()
    }
}

/// App Intent to trigger a funny sound on the toddler's camera from watchOS.
public struct PlayRemoteSoundIntent: AppIntent {
    public static var title: LocalizedStringResource = "Play Animal Sound"
    public static var description = IntentDescription("Plays a funny animal sound on ToddlerCam.")
    public static var openAppWhenRun: Bool = true

    @Parameter(title: "Sound Name", default: "quack")
    public var sound: String

    public init() {}

    public init(sound: String) {
        self.sound = sound
    }

    @MainActor
    public func perform() async throws -> some IntentResult {
        WatchRequest.shared.pendingAction = .sound(sound)
        return .result()
    }
}

/// Provides App Shortcuts for Siri and the Shortcuts app on watchOS.
public struct ToddlerCamWatchShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenToddlerCamIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Launch \(.applicationName)",
                "Open \(.applicationName) Remote",
                "Launch \(.applicationName) Remote"
            ],
            shortTitle: "Remote",
            systemImageName: "camera.fill"
        )
        AppShortcut(
            intent: TakeRemotePhotoIntent(),
            phrases: [
                "Take photo with \(.applicationName)",
                "Snap photo with \(.applicationName)",
                "Take picture with \(.applicationName)"
            ],
            shortTitle: "Take Photo",
            systemImageName: "camera.shutter.button.fill"
        )
    }
}
