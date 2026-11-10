import HeadwayKit
import SwiftUI
import UserNotifications

@main
struct HeadwayApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model = AppModel.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(.accentColor)
                .task {
                    delegate.model = model
                    await model.start()
                }
                .onChange(of: scenePhase) { _, phase in
                    model.applyLocationForRides(active: phase == .active)
                    if phase == .active { Task { await model.refresh(); await model.loadFamily() } }
                }
        }
    }
}

/// Push registration callbacks and showing alerts while the app is open.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    @MainActor var model: AppModel?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        // iOS relaunches a closed app for a significant move; no window opens, so `.task` doesn't run.
        MainActor.assumeIsolated {
            let model = AppModel.shared
            self.model = model
            model.location.onBackgroundFixes = { [weak model] fixes in model?.handleBackgroundFixes(fixes) }
            model.resumeBackgroundRides()
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in await model?.didRegister(deviceToken: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in model?.error = "Alerts are unavailable: \(error.localizedDescription)" }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        Task { @MainActor in
            await model?.refresh()
            if (notification.request.content.userInfo["kind"] as? String) == "family" { await model?.loadFamily() }
        }
        return [.banner, .sound, .list]
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var showWhatsNew = false

    var body: some View {
        Group {
            switch model.phase {
            case .launching:
                ProgressView().controlSize(.large)
            case .signedOut:
                SignInView()
            case .ready:
                MainTabs()
            }
        }
        .onChange(of: model.phase) { _, phase in
            if phase == .ready, WhatsNewView.shouldShowAutomatically { showWhatsNew = true }
        }
        .sheet(isPresented: $showWhatsNew, onDismiss: WhatsNewView.markSeen) { WhatsNewView() }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model
    @State private var tab = Self.initialTab

    /// `-screen trains|commute|family|glasses|settings` opens a tab directly (screenshots without taps).
    static var initialTab: String {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-screen"), i + 1 < args.count { return args[i + 1] }
        return "trains"
    }

    var body: some View {
        TabView(selection: $tab) {
            Tab("Trains", systemImage: "tram.fill", value: "trains") { BoardView() }
            Tab("Commute", systemImage: "arrow.left.arrow.right", value: "commute") { CommuteView() }
            Tab("Family", systemImage: "person.2.fill", value: "family") { FamilyView() }
                .badge(model.family?.invites.count ?? 0)
            Tab("Glasses", systemImage: "eyeglasses", value: "glasses") { GlassesView() }
            Tab("Settings", systemImage: "gearshape", value: "settings") { SettingsView() }
        }
    }
}
