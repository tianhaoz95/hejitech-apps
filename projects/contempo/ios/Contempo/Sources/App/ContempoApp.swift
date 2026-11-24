import ContempoCore
import SwiftUI
import UIKit
import WidgetKit

final class ContempoAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await PushRegistration.register(deviceToken: deviceToken) }
    }
}

@main
struct ContempoApp: App {
    @UIApplicationDelegateAdaptor(ContempoAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase

    init() {
        FeedbackReporting.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .onOpenURL { url in
                    // Google sign-in through Supabase returns to com.hejitech.contempoapp://login-callback.
                    ContempoBackend.client.handle(url)
                }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background {
                WidgetCenter.shared.reloadTimelines(ofKind: "HoursLockScreenWidget")
            }
        }
    }
}
