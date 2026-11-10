import SwiftUI
import UserNotifications

/// Hands iOS's push token and notification taps from the app delegate to the app model.
@MainActor
final class PushRelay {
    static let shared = PushRelay()
    var onToken: ((String) -> Void)?
    /// A notification about an edition was tapped (its date, when the push carried one).
    var onOpenEdition: ((String?) -> Void)?
    private var pendingToken: String?

    func deliver(token: String) {
        pendingToken = token
        onToken?(token)
    }

    /// Asks iOS for permission (once) and registers with APNs. Returns whether alerts are allowed.
    func enable() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted { UIApplication.shared.registerForRemoteNotifications() }
        return granted
    }

    /// Registers again at launch when the user already allowed notifications (tokens can change).
    func refreshRegistration() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
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
        let date = notification.request.content.userInfo["date"] as? String
        await MainActor.run { PushRelay.shared.onOpenEdition?(date) }
        return [.banner, .sound, .list]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let date = response.notification.request.content.userInfo["date"] as? String
        await MainActor.run { PushRelay.shared.onOpenEdition?(date) }
    }
}
