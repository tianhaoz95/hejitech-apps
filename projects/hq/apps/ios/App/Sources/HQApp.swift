import BackgroundTasks
import SwiftUI
import UserNotifications

@main
struct HQApp: App {
    @State private var model = AppModel()
    @State private var showWhatsNew = WhatsNew.shouldShow

    init() {
        DigestNotifier.register()
    }

    var body: some Scene {
        WindowGroup {
            Group {
                switch model.phase {
                case .loading:
                    ProgressView()
                case .signedOut:
                    SignInView()
                case .noWorkspace:
                    NavigationStack { WorkspaceSetupView(first: true) }
                case .ready:
                    RootTabs()
                        .sheet(isPresented: $showWhatsNew) { WhatsNewView() }
                }
            }
            .environment(model)
            .task { await model.load() }
            .onOpenURL { url in Task { await model.open(url) } }
        }
    }
}

/// Who's signed in, their workspaces, and which one the app shows.
@Observable @MainActor
final class AppModel {
    enum Phase { case loading, signedOut, noWorkspace, ready }
    var phase: Phase = .loading
    var workspaces: [Workspace] = []
    var email: String?
    var error: String?

    var current: Workspace? { workspaces.first { $0.id == SessionStore.workspaceId } }
    var canDecide: Bool { ["admin", "approver"].contains(current?.role ?? "") }
    var isAdmin: Bool { current?.role == "admin" }

    init() {
        #if DEBUG
        // Debug hooks so screens can be reached without taps: -signInEmail <e> -signInPassword <p>
        // (local accounts) and -screen inbox|health|runs|settings|card:<id>.
        if UserDefaults.standard.string(forKey: "screen") != nil { WhatsNew.markSeen() }
        #endif
    }

    func load() async {
        #if DEBUG
        let d = UserDefaults.standard
        if Backend.shared.session == nil, let e = d.string(forKey: "signInEmail"), let p = d.string(forKey: "signInPassword") {
            do { try await Backend.shared.signIn(email: e, password: p) } catch { self.error = "Test sign-in at \(Backend.shared.config.supabaseURL.host() ?? ""): \(error.localizedDescription)" }
        }
        #endif
        guard Backend.shared.session != nil else { phase = .signedOut; return }
        do {
            let me = try await HQClient().me()
            email = me.user.email
            workspaces = me.workspaces
            if current == nil { SessionStore.workspaceId = workspaces.first?.id ?? "" }
            phase = workspaces.isEmpty ? .noWorkspace : .ready
        } catch let e as APIError where e.isUnauthorized {
            Backend.shared.signOut()
            phase = .signedOut
        } catch {
            self.error = error.localizedDescription
            phase = workspaces.isEmpty ? .signedOut : .ready
        }
    }

    func select(_ id: String) {
        SessionStore.workspaceId = id
        workspaces = workspaces // notify
    }

    func signOut() {
        Backend.shared.signOut()
        workspaces = []
        phase = .signedOut
    }

    /// hq://join/<code> opens an invite.
    func open(_ url: URL) async {
        guard url.scheme == "hq", url.host == "join" else { return }
        let code = url.lastPathComponent
        guard Backend.shared.session != nil else { UserDefaults.standard.set(code, forKey: "hq.pending-join"); return }
        await join(code)
    }

    func join(_ code: String) async {
        do {
            let ws = try await HQClient().acceptInvite(code)
            SessionStore.workspaceId = ws.id
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct RootTabs: View {
    @Environment(AppModel.self) private var model
    @State private var tab = UserDefaults.standard.string(forKey: "screen") ?? "inbox"

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack {
                if tab.hasPrefix("card:") { CardDetailView(cardID: String(tab.dropFirst(5)), reasons: []) } else { InboxView() }
            }
            .tabItem { Label("Inbox", systemImage: "tray.full") }.tag(tab.hasPrefix("card:") ? tab : "inbox")
            NavigationStack { HealthView() }.tabItem { Label("Health", systemImage: "heart.text.square") }.tag("health")
            NavigationStack { RunsView() }.tabItem { Label("Runs", systemImage: "gearshape.2") }.tag("runs")
            NavigationStack { SettingsView() }.tabItem { Label("Settings", systemImage: "slider.horizontal.3") }.tag("settings")
        }
        .id(SessionStore.workspaceId) // switching workspace reloads every tab
        .tint(Color.accentColor)
    }
}

/// A background check that posts "N cards need you" as a local notification. Push via APNs is a
/// later step (docs/decisions.md).
enum DigestNotifier {
    static let taskID = "com.hejitech.hq.digest"

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskID, using: nil) { task in
            schedule()
            let work = Task {
                guard Backend.shared.session != nil, !SessionStore.workspaceId.isEmpty, let d = try? await HQClient().digest() else { task.setTaskCompleted(success: false); return }
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
