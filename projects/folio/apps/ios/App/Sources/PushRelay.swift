import SwiftUI
import UserNotifications

/// iOS's side of notifications: permission, the APNs token, the buttons on Folio's notifications
/// (Accept / Reject on a suggestion, Reply on a comment) and what a tap opens.
@MainActor
final class PushRelay {
    static let shared = PushRelay()

    static let accept = "FOLIO_ACCEPT"
    static let reject = "FOLIO_REJECT"
    static let reply = "FOLIO_REPLY"

    /// The categories the Worker names in each push (`aps.category`).
    static var categories: Set<UNNotificationCategory> {
        let accept = UNNotificationAction(identifier: Self.accept, title: "Accept", options: [.authenticationRequired], icon: UNNotificationActionIcon(systemImageName: "checkmark"))
        let reject = UNNotificationAction(identifier: Self.reject, title: "Reject", options: [.authenticationRequired, .destructive], icon: UNNotificationActionIcon(systemImageName: "xmark"))
        let reply = UNTextInputNotificationAction(identifier: Self.reply, title: "Reply", options: [.authenticationRequired], icon: UNNotificationActionIcon(systemImageName: "arrowshape.turn.up.left"), textInputButtonTitle: "Send", textInputPlaceholder: "Your reply")
        return [
            UNNotificationCategory(identifier: "FOLIO_SUGGESTION", actions: [accept, reject, reply], intentIdentifiers: []),
            UNNotificationCategory(identifier: "FOLIO_COMMENT", actions: [reply], intentIdentifiers: []),
            UNNotificationCategory(identifier: "FOLIO_VERSION", actions: [], intentIdentifiers: []),
        ]
    }

    /// Asks iOS for permission (once) and registers with APNs. Returns whether alerts are allowed.
    func enable() async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted { UIApplication.shared.registerForRemoteNotifications() }
        return granted
    }

    /// Registers again at launch when notifications are allowed (tokens can change).
    func refreshRegistration() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    /// A button on a notification couldn't do its job (the suggestion moved on, no connection…).
    func notifyFailure(_ message: String) async {
        let c = UNMutableNotificationContent()
        c.title = "Folio couldn't do that"
        c.body = message
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: nil))
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.setNotificationCategories(PushRelay.categories)
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in AppModel.shared.didReceive(pushToken: hex) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("APNs registration failed: \(error)")
    }

    // In the foreground: show the banner and refresh the lists behind it.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        await AppModel.shared.refresh()
        return [.banner, .sound, .list]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        switch response.actionIdentifier {
        case UNNotificationDefaultActionIdentifier:
            await AppModel.shared.openNotification(info)
        case UNNotificationDismissActionIdentifier:
            break
        default:
            let text = (response as? UNTextInputNotificationResponse)?.userText
            await AppModel.shared.performNotificationAction(response.actionIdentifier, info: info, text: text)
            await AppModel.shared.refresh()
        }
    }
}
