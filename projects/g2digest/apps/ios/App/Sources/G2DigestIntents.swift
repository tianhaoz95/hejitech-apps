import AppIntents
import Foundation
import G2DigestKit

// Note: Never include the word "Apple" in any App Intent title, description, or shortcut phrase (ITMS-90626).

public struct OpenLatestEditionIntent: AppIntent {
    public static var title: LocalizedStringResource = "Open Latest Edition"
    public static var description = IntentDescription("Opens your most recent G2 Digest edition.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(name: .g2DigestOpenLatest, object: nil)
        return .result()
    }
}

public struct PlayTodaysDigestIntent: AppIntent {
    public static var title: LocalizedStringResource = "Play Morning Briefing"
    public static var description = IntentDescription("Starts continuous glance audio playback for your latest G2 Digest edition.")
    public static var openAppWhenRun: Bool = true

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(name: .g2DigestPlayAllGlances, object: nil)
        return .result()
    }
}

public struct ReadHeadlineIntent: AppIntent {
    public static var title: LocalizedStringResource = "Read Latest Headline"
    public static var description = IntentDescription("Reads the lead headline from your latest G2 Digest edition.")
    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let data = UserDefaults.standard.data(forKey: WidgetEditionSnapshot.storageKey),
              let snap = try? JSONDecoder().decode(WidgetEditionSnapshot.self, from: data) else {
            return .result(dialog: "Open G2 Digest to fetch your latest edition.")
        }
        let lead = snap.leadTitle ?? snap.title
        let alerts = snap.alertCount > 0 ? " \(snap.alertCount) alert\(snap.alertCount == 1 ? "" : "s")." : ""
        return .result(dialog: "\(snap.title) for \(snap.date).\(alerts) Lead story: \(lead).")
    }
}

public struct G2DigestShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PlayTodaysDigestIntent(),
            phrases: [
                "Play my \(.applicationName) briefing",
                "Start \(.applicationName) audio",
            ],
            shortTitle: "Play Briefing",
            systemImageName: "headphones"
        )
        AppShortcut(
            intent: ReadHeadlineIntent(),
            phrases: [
                "Read my \(.applicationName) headline",
                "What's in \(.applicationName)",
            ],
            shortTitle: "Latest Headline",
            systemImageName: "newspaper"
        )
        AppShortcut(
            intent: OpenLatestEditionIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Show latest \(.applicationName)",
            ],
            shortTitle: "Latest Edition",
            systemImageName: "eyeglasses"
        )
    }
}

public extension Notification.Name {
    static let g2DigestOpenLatest = Notification.Name("g2DigestOpenLatest")
    static let g2DigestPlayAllGlances = Notification.Name("g2DigestPlayAllGlances")
}
