import AuthenticationServices
import FitLoopKit
import Observation
import SwiftUI
import UserNotifications

/// The app's state: sign-in, today (from the Worker, which merges the plan and check-ins), the plan,
/// settings, reminders, the open workout (with the Watch's heart rate) and Apple Health sync.
@MainActor @Observable
final class AppModel {
    enum Phase { case launching, signedOut, ready }

    var phase: Phase = .launching
    var email: String?
    var date = Day.string()
    var today: TodayResponse?
    var plan: PlanResponse?
    var settings = Settings.defaults
    var error: String?
    var loading = false
    /// The workout open in the player (its ref), and the Watch's latest heart rate.
    var activeWorkout: String?
    var heartRate: Int?

    private(set) var backend: Backend
    let health = HealthSync()
    let watch = WatchLink()
    private var lastLivePost = Date.distantPast

    /// Where Supabase sends the browser back after Google sign-in (allow-listed in the shared project).
    static let authRedirect = "fitloop://login-callback"

    static var config: BackendConfig {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-production") ? .production : .local
        #else
        .production
        #endif
    }

    init() {
        // The Keychain outlives the app: a fresh install must not pick up a previous install's session.
        if !UserDefaults.standard.bool(forKey: "installed") {
            Keychain.set(nil, for: "session")
            UserDefaults.standard.set(true, forKey: "installed")
        }
        let session = Keychain.get("session").flatMap { try? JSONDecoder().decode(AuthSession.self, from: $0) }
        backend = Backend(config: Self.config, session: session)
        backend.onSessionChange = { s in Keychain.set(s.flatMap { try? JSONEncoder().encode($0) }, for: "session") }
        #if DEBUG
        // `-date YYYY-MM-DD` opens another day (screenshots of a workout day without taps).
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-date"), i + 1 < args.count { date = args[i + 1] }
        #endif
        watch.onHeartRate = { [weak self] hr in Task { @MainActor in await self?.heartRate(hr) } }
        watch.onSetDone = { [weak self] in Task { @MainActor in self?.watchSetDone?() } }
        watch.onEnded = { [weak self] in Task { @MainActor in self?.heartRate = nil } }
    }

    /// The workout player registers what "set done" on the Watch means.
    var watchSetDone: (() -> Void)?

    // MARK: launch and routing

    func start() async {
        watch.activate()
        await route()
    }

    /// After launch and after every sign-in path: to the app, or to sign-in.
    func route() async {
        guard let s = backend.session else { phase = .signedOut; return }
        email = s.email
        do {
            let r = try await backend.settings()
            settings = r.settings
            email = r.email ?? s.email
            // The agent's "today" follows the phone's time zone.
            if settings.timezone != TimeZone.current.identifier {
                settings.timezone = TimeZone.current.identifier
                settings = (try? await backend.save(settings))?.settings ?? settings
            }
            phase = .ready
            await refresh()
            await syncHealth()
        } catch BackendError.notSignedIn {
            phase = .signedOut
        } catch let e as BackendError where e.isUnauthorized {
            backend.signOut()
            phase = .signedOut
        } catch {
            phase = .ready
            self.error = error.localizedDescription
        }
    }

    // MARK: sign-in

    func signInWithGoogle(using session: WebAuthenticationSession) async {
        do {
            let (url, verifier) = backend.oauthStart(provider: "google", redirect: Self.authRedirect)
            let callback = try await session.authenticate(using: url, callbackURLScheme: "fitloop")
            let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
            guard let code = items.first(where: { $0.name == "code" })?.value else {
                let reason = items.first(where: { $0.name == "error_description" })?.value ?? "no code in the callback"
                throw BackendError.decode(reason.replacingOccurrences(of: "+", with: " "))
            }
            try await backend.exchangeCode(code, verifier: verifier)
            await route()
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            return
        } catch { self.error = "Google sign-in failed: \(error.localizedDescription)" }
    }

    func signInWithApple(_ result: Result<ASAuthorization, Error>) async {
        do {
            guard case .success(let auth) = result, let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let token = cred.identityToken.flatMap({ String(data: $0, encoding: .utf8) }) else {
                if case .failure(let e) = result, (e as? ASAuthorizationError)?.code == .canceled { return }
                if case .failure(let e) = result { throw e }
                return
            }
            try await backend.signIn(provider: "apple", idToken: token)
            await route()
        } catch { self.error = "Apple sign-in failed: \(error.localizedDescription)" }
    }

    func signInWithEmail(_ email: String, _ password: String) async {
        do {
            try await backend.signIn(email: email, password: password)
            await route()
        } catch { self.error = error.localizedDescription }
    }

    /// Email sign-in for accounts FitLoop hands out (App Review's demo account); no sign-up.
    func signInWithEmailAccount(_ email: String, _ password: String) async -> Bool {
        do {
            try await backend.reviewSignIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
            await route()
            return true
        } catch {
            self.error = (error as? BackendError).flatMap { if case .http(401, _) = $0 { return "Wrong email or password." }; return nil } ?? error.localizedDescription
            return false
        }
    }

    func signOut() {
        backend.signOut()
        today = nil
        plan = nil
        settings = .defaults
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        phase = .signedOut
    }

    func deleteData() async {
        do {
            try await backend.deleteData()
            signOut()
        } catch { self.error = error.localizedDescription }
    }

    // MARK: data

    /// Runs in its own task: a view's `.task` ending (sign-in swapping screens) or a released
    /// pull-to-refresh must not cancel a refresh halfway.
    func refresh() async {
        await Task { await self.refreshNow() }.value
    }

    private func refreshNow() async {
        guard phase == .ready else { return }
        loading = true
        defer { loading = false }
        do {
            async let t = backend.today(date)
            async let p = backend.plan()
            today = try await t
            plan = try await p
            sendProgressToWatch()
            error = nil
            await scheduleReminders()
        } catch let e as BackendError where e.isUnauthorized || e == .notSignedIn {
            phase = .signedOut
        } catch {
            self.error = "Couldn't refresh: \(error.localizedDescription)"
        }
    }

    func show(date: String) async {
        self.date = date
        await refresh()
    }

    func checkin(_ c: NewCheckin) async {
        do {
            try await backend.checkin([c])
            today = try await backend.today(date)
            sendProgressToWatch()
        } catch { self.error = error.localizedDescription }
    }

    func sendFeedback(ref: String?, text: String, tags: [FeedbackTag]) async -> Bool {
        do {
            try await backend.sendFeedback(NewFeedback(date: date, ref: ref, text: text, tags: tags.map(\.rawValue)))
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func save(_ s: Settings) async -> Bool {
        do {
            settings = try await backend.save(s).settings
            await scheduleReminders()
            await syncHealth()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    // MARK: workouts, the Watch and live heart rate

    func beginWorkout(_ ref: String) {
        activeWorkout = ref
        watch.startOnWatch()
    }

    func updateWatch(title: String, exercise: String, setLine: String, restUntil: Date?, progress: String) {
        guard let ref = activeWorkout else { return }
        watch.send(context: [
            WatchMessage.workoutRef: ref, WatchMessage.workoutTitle: title, WatchMessage.exerciseName: exercise,
            WatchMessage.setLine: setLine, WatchMessage.restUntil: restUntil?.timeIntervalSince1970 ?? 0, WatchMessage.progress: progress,
        ])
    }

    /// Today's completion for the watch face (only today's; browsing another day changes nothing).
    func sendProgressToWatch() {
        guard let t = today, t.state.date == DayProgress.localDate() else { return }
        let s = t.state
        let next = s.workouts.first { $0.status == "todo" || $0.status == "in_progress" }?.workout.title
            ?? s.meals.first { $0.status == "todo" }?.meal.name
        watch.send(progress: DayProgress(
            date: s.date, completion: s.completion,
            workoutsDone: s.workouts.filter { $0.status == "done" }.count, workoutsTotal: s.workouts.count,
            mealsDone: s.meals.filter { $0.status == "done" }.count, mealsTotal: s.meals.count,
            next: next
        ))
    }

    func endWorkout() async {
        activeWorkout = nil
        heartRate = nil
        watch.send(context: [WatchMessage.workoutRef: ""])
        if settings.vitals.liveHr { try? await backend.live(hr: nil, workoutRef: nil) }
    }

    private func heartRate(_ hr: Int) async {
        heartRate = hr
        // Relay to the Worker for the glasses, at most every 4 s.
        guard settings.vitals.liveHr, Date().timeIntervalSince(lastLivePost) > 4 else { return }
        lastLivePost = Date()
        try? await backend.live(hr: hr, workoutRef: activeWorkout)
    }

    // MARK: reminders (local notifications)

    func requestNotifications() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        await scheduleReminders()
    }

    func scheduleReminders() async {
        let center = UNUserNotificationCenter.current()
        let status = await center.notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional else { return }
        center.removeAllPendingNotificationRequests()
        for r in ReminderPlanner.plan(plan?.current, settings: settings, from: Day.string()) {
            let content = UNMutableNotificationContent()
            content.title = r.title
            content.body = r.body
            content.sound = .default
            content.threadIdentifier = r.id.components(separatedBy: ":").first ?? "fitloop"
            let req = UNNotificationRequest(identifier: r.id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: r.date, repeats: false))
            try? await center.add(req)
        }
    }

    // MARK: Apple Health

    func syncHealth() async {
        guard settings.vitals.healthDaily, health.available else { return }
        #if DEBUG
        // `-noHealth`: no Health permission sheet (automated screenshots).
        if ProcessInfo.processInfo.arguments.contains("-noHealth") { return }
        #endif
        let vitals = await health.dailySummary(days: 14)
        guard !vitals.isEmpty else { return }
        try? await backend.sendVitals(vitals)
    }
}

enum Keychain {
    static func set(_ data: Data?, for key: String) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key]
        SecItemDelete(q as CFDictionary)
        guard let data else { return }
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static func get(_ key: String) -> Data? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key,
                                kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: CFTypeRef?
        return SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }
}
