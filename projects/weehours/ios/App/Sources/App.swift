import AppIntents
import AuthenticationServices
import FeedbackKit
import LogCore
import SwiftUI

@main
struct WeeHoursApp: App {
    @StateObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Background tasks must be registered once, before launch finishes; registering again
        // (e.g. from a view's `.task`, which re-runs whenever the view reappears) aborts the app.
        let model = AppModel()
        _model = StateObject(wrappedValue: model)
        AppModel.registerBackgroundTasks(model)
        WeeHoursShortcuts.updateAppShortcutParameters()
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "pk_bdbb442ad21b2c2b2a6d63bdbd8621aa1b79"
        ))
        Feedback.apply(enabled: Feedback.isEnabled)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .task { await model.start() }
                .onOpenURL { url in
                    if url.host == "voice" { model.startVoice() }
                }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active: Task { await model.syncNow() }   // pending glasses captures are processed here first
            case .background: AppModel.scheduleBackgroundSync()
            default: break
            }
        }
    }
}

/// Siri phrases and the Action Button. "Hey Siri, log a wet diaper in Wee Hours."
struct WeeHoursShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: StatusIntent(), phrases: ["What's next in \(.applicationName)", "When did the baby eat in \(.applicationName)"],
                    shortTitle: "Status", systemImageName: "clock")
        AppShortcut(intent: ToggleFeedIntent(), phrases: ["Start a feed in \(.applicationName)", "Finish the feed in \(.applicationName)"],
                    shortTitle: "Feed", systemImageName: "drop.fill")
        AppShortcut(intent: LogDiaperIntent(), phrases: ["Log a \(\.$kind) diaper in \(.applicationName)", "Log a diaper in \(.applicationName)"],
                    shortTitle: "Diaper", systemImageName: "humidity.fill")
        AppShortcut(intent: ToggleSleepIntent(), phrases: ["Baby is asleep in \(.applicationName)", "Baby woke up in \(.applicationName)"],
                    shortTitle: "Sleep", systemImageName: "moon.zzz.fill")
        AppShortcut(intent: VoiceLogIntent(), phrases: ["Log by voice in \(.applicationName)"],
                    shortTitle: "Speak", systemImageName: "mic.fill")
    }
}

/// For the Action Button: opens straight into push-to-talk.
struct VoiceLogIntent: AppIntent {
    static let title: LocalizedStringResource = "Speak a log entry"
    static let openAppWhenRun = true
    @MainActor
    func perform() async throws -> some IntentResult {
        if let url = URL(string: "weehours://voice") { await UIApplication.shared.open(url) }
        return .result()
    }
}

struct RootView: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Group {
            switch model.phase {
            case .loading: ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            case .signedOut: SignInView()
            case .needsHousehold: HouseholdSetupView()
            case .ready: MainView()
            }
        }
        .tint(Theme.accent)
        .alert("Something went wrong", isPresented: Binding(get: { model.error != nil }, set: { if !$0 { model.error = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.error ?? "")
        }
    }
}

enum Theme {
    static let accent = Color(red: 0.95, green: 0.62, blue: 0.40)
    static let feed = Color(red: 0.98, green: 0.70, blue: 0.45)
    static let diaper = Color(red: 0.45, green: 0.75, blue: 0.95)
    static let sleep = Color(red: 0.62, green: 0.58, blue: 0.95)
    static let other = Color(red: 0.55, green: 0.85, blue: 0.65)
    static let card = Color(.secondarySystemBackground)

    static func color(for type: String) -> Color {
        if type.hasPrefix("feed") { return feed }
        if type == "diaper" { return diaper }
        if type.hasPrefix("sleep") { return sleep }
        return other
    }

    static func icon(for type: String) -> String {
        switch type {
        case let t where t.hasPrefix("feed.bottle"): return "waterbottle.fill"
        case let t where t.hasPrefix("feed.breast"): return "heart.fill"
        case "feed.solids": return "fork.knife"
        case "diaper": return "humidity.fill"
        case "sleep.start": return "moon.zzz.fill"
        case "sleep.end": return "sun.max.fill"
        case "pump": return "drop.triangle.fill"
        case "weight": return "scalemass.fill"
        case "note": return "text.bubble.fill"
        default: return "circle.fill"
        }
    }
}

// MARK: - Sign in

struct SignInView: View {
    @EnvironmentObject var model: AppModel
    @State private var email = "parent1@example.com"
    @State private var password = "newborn-dev"
    @State private var showServer = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Spacer(minLength: 40)
                Image(systemName: "moon.stars.fill").font(.system(size: 44)).foregroundStyle(Theme.accent)
                Text("Wee Hours").font(.largeTitle.bold())
                Text("Log a feed, diaper or nap in three seconds, by voice, a tap, your watch or your glasses.")
                    .foregroundStyle(.secondary)
                SignInWithAppleButton(.signIn) { req in req.requestedScopes = [.email] } onCompletion: { r in
                    Task { await model.signInWithApple(r) }
                }
                .frame(height: 48)
                .signInWithAppleButtonStyle(.whiteOutline)
                Button {
                    model.error = "Google sign-in is wired to Supabase but needs the hosted project's Google client id (see README → Auth). Use email for local testing."
                } label: {
                    Label("Continue with Google", systemImage: "g.circle.fill").frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.bordered)
                Divider().padding(.vertical, 4)
                Text("Email (local development)").font(.footnote).foregroundStyle(.secondary)
                TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never).textFieldStyle(.roundedBorder)
                SecureField("Password", text: $password).textFieldStyle(.roundedBorder)
                HStack {
                    Button("Sign in") { Task { await model.signIn(email: email, password: password, create: false) } }
                        .buttonStyle(.borderedProminent)
                    Button("Create account") { Task { await model.signIn(email: email, password: password, create: true) } }
                        .buttonStyle(.bordered)
                }
                Divider().padding(.vertical, 4)
                Button {
                    model.useWithoutAccount()
                } label: {
                    Label("Use without an account", systemImage: "iphone").frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("localOnly")
                Text("Everything stays on this iPhone: logging, voice, reminders, widgets and the watch. Sign in later to sync with your partner; your log comes with you.")
                    .font(.footnote).foregroundStyle(.secondary)
                DisclosureGroup("Server", isExpanded: $showServer) {
                    TextField("Supabase URL", text: $model.backendURL).textFieldStyle(.roundedBorder).textInputAutocapitalization(.never)
                }
                .font(.footnote)
            }
            .padding(24)
        }
    }
}

// MARK: - Household setup

struct HouseholdSetupView: View {
    @EnvironmentObject var model: AppModel
    @State private var name = ""
    @State private var babyName = ""
    @State private var birth = Date()
    @State private var categories = EventRegistry.shared.defaultCategories
    @State private var defaultFeed = "bottle"
    @State private var bottleMl = 120.0
    @State private var code = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("You") { TextField("Your name", text: $name) }
                Section("Baby") {
                    TextField("Baby's name", text: $babyName)
                    DatePicker("Born", selection: $birth, in: ...Date(), displayedComponents: .date)
                }
                Section {
                    ForEach(EventRegistry.shared.categories, id: \.id) { c in
                        Toggle(c.label, isOn: Binding(get: { categories.contains(c.id) }, set: { on in
                            if on { categories.insert(c.id) } else { categories.remove(c.id) }
                        }))
                    }
                    Picker("Quick feed starts", selection: $defaultFeed) {
                        Text("Bottle").tag("bottle")
                        Text("Breastfeeding").tag("breast")
                    }
                    Stepper("Bottle size \(Int(bottleMl)) ml", value: $bottleMl, in: 30...360, step: 10)
                } header: { Text("What you track") } footer: {
                    Text("Turn on only what you use: fewer options make voice logging more accurate.")
                }
                Section {
                    Button("Create household") {
                        let h = Household(name: "\(name)'s family", babyName: babyName.isEmpty ? "Baby" : babyName, birthDate: birth,
                                          bottleMl: bottleMl, categories: categories.sorted(), defaultFeed: defaultFeed)
                        Task { await model.createHousehold(h, displayName: name.isEmpty ? "Parent" : name) }
                    }
                    .disabled(name.isEmpty)
                }
                if !model.localOnly {
                Section("Or join your partner") {
                    TextField("Invite code", text: $code).textInputAutocapitalization(.characters)
                    Button("Join") { Task { await model.join(code: code, displayName: name.isEmpty ? "Parent" : name) } }
                        .disabled(code.count < 6 || name.isEmpty)
                }
                }
            }
            .navigationTitle("Set up")
        }
    }
}

/// Shake to report a problem (FeedbackKit). On by default; Settings turns it off, which also stops
/// the "is it fixed?" card for the reporter's earlier reports.
enum Feedback {
    static let key = "shakeToReport"

    static var isEnabled: Bool { UserDefaults.standard.object(forKey: key) as? Bool ?? true }

    static func apply(enabled: Bool) {
        if enabled {
            FeedbackKit.enableShakeToReport(presenter: topViewController)
            FeedbackKit.enableFixVerification(presenter: topViewController)
        } else {
            FeedbackKit.disableShakeToReport()
            FeedbackKit.disableFixVerification()
        }
    }

    private static func topViewController() -> UIViewController? {
        var vc = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }
}
