import FitLoopKit
import SwiftUI
import UserNotifications

@main
struct FitLoopApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(.accentColor)
                .task { await model.start() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active, model.phase == .ready {
                        // A new day since the app was last open: show it.
                        if model.date < Day.string() { model.date = Day.string() }
                        Task { await model.refresh() }
                    }
                }
        }
    }
}

/// Shows reminders while the app is open.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var showWhatsNew = false

    var body: some View {
        Group {
            switch model.phase {
            case .launching: ProgressView().controlSize(.large)
            case .signedOut: SignInView()
            case .ready: MainTabs()
            }
        }
        .onChange(of: model.phase) { _, phase in
            if phase == .ready, WhatsNewView.shouldShowAutomatically { showWhatsNew = true }
        }
        .sheet(isPresented: $showWhatsNew, onDismiss: WhatsNewView.markSeen) { WhatsNewView() }
    }
}

struct MainTabs: View {
    @State private var tab = Self.initialTab

    /// `-screen today|plan|progress|feedback|settings` opens a tab directly (screenshots without taps).
    static var initialTab: String {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-screen"), i + 1 < args.count { return args[i + 1] }
        return "today"
    }

    var body: some View {
        TabView(selection: $tab) {
            Tab("Today", systemImage: "checklist", value: "today") { TodayView() }
            Tab("Plan", systemImage: "calendar", value: "plan") { PlanView() }
            Tab("Progress", systemImage: "chart.line.uptrend.xyaxis", value: "progress") { ProgressScreen() }
            Tab("Feedback", systemImage: "bubble.left.and.text.bubble.right", value: "feedback") { FeedbackView() }
            Tab("Settings", systemImage: "gearshape", value: "settings") { SettingsView() }
        }
    }
}
