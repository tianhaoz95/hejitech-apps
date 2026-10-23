import ContempoCore
import SwiftUI
import WidgetKit

@main
struct ContempoApp: App {
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
