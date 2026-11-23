import SwiftUI
import UserNotifications

/// Hands iOS's push token and notification taps from the app delegate to the app model.
@MainActor
final class PushRelay {
    static let shared = PushRelay()
    var onToken: ((String) -> Void)?
    /// A notification about an edition was tapped (its date, and whether to auto-play glances).
    var onOpenEdition: ((String?, Bool) -> Void)?
    private var pendingToken: String?

    func deliver(token: String) {
        pendingToken = token
        onToken?(token)
    }

    func registerCategories() {
        let playAction = UNNotificationAction(identifier: "PLAY_GLANCE", title: "Play Briefing", options: [.foreground])
        let category = UNNotificationCategory(identifier: "NEW_EDITION", actions: [playAction], intentIdentifiers: [])
        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    /// Asks iOS for permission (once) and registers with APNs. Returns whether alerts are allowed.
    func enable() async -> Bool {
        let center = UNUserNotificationCenter.current()
        registerCategories()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted { UIApplication.shared.registerForRemoteNotifications() }
        return granted
    }

    /// Registers again at launch when the user already allowed notifications (tokens can change).
    func refreshRegistration() async {
        registerCategories()
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { @MainActor in PushRelay.shared.registerCategories() }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in PushRelay.shared.deliver(token: hex) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("APNs registration failed: \(error)")
    }

    // A new edition arriving while the app is open still shows as a banner.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        let info = notification.request.content.userInfo
        let date = (info["edition_date"] as? String) ?? (info["date"] as? String)
        await MainActor.run { PushRelay.shared.onOpenEdition?(date, false) }
        return [.banner, .sound, .list]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        let date = (info["edition_date"] as? String) ?? (info["date"] as? String)
        let shouldPlay = response.actionIdentifier == "PLAY_GLANCE"
        await MainActor.run { PushRelay.shared.onOpenEdition?(date, shouldPlay) }
    }
}
