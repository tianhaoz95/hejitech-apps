import BackgroundTasks
import SwiftUI
import UserNotifications

@main
struct HQApp: App {
    @State private var connected = Connection.isConfigured
    @State private var showWhatsNew = WhatsNew.shouldShow

    init() {
        Self.applyLaunchArguments()
        DigestNotifier.register()
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if connected {
                    RootTabs(connected: $connected)
                        .sheet(isPresented: $showWhatsNew) { WhatsNewView() }
                } else {
                    ConnectView(connected: $connected)
                }
            }
            .onAppear { connected = Connection.isConfigured }
        }
    }

    /// Debug hooks so screens can be reached and screenshotted without taps:
    /// `-serverURL <url> -ownerToken <token> -screen inbox|health|runs|settings|card:<id>`.
    private static func applyLaunchArguments() {
        #if DEBUG
        let d = UserDefaults.standard
        if let u = d.string(forKey: "serverURL") { Connection.serverURL = u }
        if let t = d.string(forKey: "ownerToken") { Connection.token = t }
        if d.string(forKey: "screen") != nil { WhatsNew.markSeen() }
        #endif
    }
}

struct RootTabs: View {
    @Binding var connected: Bool
    @State private var tab = UserDefaults.standard.string(forKey: "screen") ?? "inbox"

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack {
                if tab.hasPrefix("card:") { CardDetailView(cardID: String(tab.dropFirst(5)), reasons: []) } else { InboxView() }
            }
            .tabItem { Label("Inbox", systemImage: "tray.full") }.tag(tab.hasPrefix("card:") ? tab : "inbox")
            NavigationStack { HealthView() }.tabItem { Label("Health", systemImage: "heart.text.square") }.tag("health")
            NavigationStack { RunsView() }.tabItem { Label("Runs", systemImage: "gearshape.2") }.tag("runs")
            NavigationStack { SettingsView(connected: $connected) }.tabItem { Label("Settings", systemImage: "slider.horizontal.3") }.tag("settings")
        }
        .tint(Color.accentColor)
    }
}

/// A daily-ish background check that posts "N cards need you" as a local notification. Push via
/// APNs is a later step (docs/decisions.md).
enum DigestNotifier {
    static let taskID = "com.hejitech.hq.digest"

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskID, using: nil) { task in
            schedule()
            let work = Task {
                guard Connection.isConfigured, let d = try? await HQClient().digest() else { task.setTaskCompleted(success: false); return }
                await notify(d)
                task.setTaskCompleted(success: true)
            }
            task.expirationHandler = { work.cancel() }
        }
        schedule()
    }

    static func schedule() {
        let r = BGAppRefreshTaskRequest(identifier: taskID)
        r.earliestBeginDate = Date(timeIntervalSinceNow: 6 * 3600)
        try? BGTaskScheduler.shared.submit(r)
    }

    static func requestPermission() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
    }

    static func updateBadge(_ n: Int) {
        UNUserNotificationCenter.current().setBadgeCount(n)
    }

    static func notify(_ d: Digest) async {
        updateBadge(d.needs_you)
        guard d.needs_you > 0 || d.failed + d.runs_failed > 0 else { return }
        let c = UNMutableNotificationContent()
        c.title = "HQ"
        c.body = "\(d.shipped) shipped, \(d.needs_you) need you\(d.failed + d.runs_failed > 0 ? ", \(d.failed + d.runs_failed) failed" : "")."
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "digest", content: c, trigger: nil))
    }
}
