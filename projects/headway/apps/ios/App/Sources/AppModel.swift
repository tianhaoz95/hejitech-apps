import AuthenticationServices
import HeadwayKit
import Observation
import SwiftUI
import UserNotifications
#if canImport(WidgetKit)
import WidgetKit
#endif

/// The app's state: sign-in, the commute board (refreshed while open), settings, glasses pairing
/// and push registration. Every board comes from the Worker, which merges the timetable and
/// Caltrain's live feed; the app only shows it.
@MainActor @Observable
final class AppModel {
    enum Phase { case launching, signedOut, ready }

    var phase: Phase = .launching
    var email: String?
    var board: Board?
    var hasCommute = false
    var tracked: TrackedWithProgress?
    var settings = Settings.defaults
    var settingsSaved = false
    var stations: [Station] = []
    /// A pair picked on the Trains tab instead of the commute (nil: the commute for the time of day).
    var customPair: (from: String, to: String)?
    var expressPreference: ExpressPreference = .all
    var error: String?
    var loading = false
    var notificationsAllowed: Bool?
    /// "from>to" of the board pinned to the Lock Screen as a Live Activity.
    var pinnedBoard: String?

    let watch = WatchLink()
    private(set) var backend: Backend
    private var pushToken: String?

    /// Where Supabase sends the browser back after Google sign-in (allow-listed in the shared project).
    static let authRedirect = "headway://login-callback"

    static var config: BackendConfig {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-production") ? .production : .local
        #else
        .production
        #endif
    }

    static var isSandbox: Bool {
        #if DEBUG
        true
        #else
        false
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
        backend.onSessionChange = { [weak self] s in
            Keychain.set(s.flatMap { try? JSONEncoder().encode($0) }, for: "session")
            Task { @MainActor in self?.syncWatch() }
        }
        if let cached = UserDefaults.standard.data(forKey: "stations"), let s = try? JSONDecoder().decode([Station].self, from: cached) { stations = s }

        watch.onTrack = { [weak self] tripId, serviceDate, from, to in
            Task { @MainActor in
                try? await self?.backend.track(Tracked(tripId: tripId, serviceDate: serviceDate, from: from, to: to))
                await self?.refresh()
            }
        }
        watch.onUntrack = { [weak self] in
            Task { @MainActor in
                await self?.untrack()
            }
        }
        watch.onFlip = { [weak self] in
            Task { @MainActor in
                await self?.flip()
            }
        }
        watch.onRefresh = { [weak self] in
            Task { @MainActor in
                await self?.refresh()
            }
        }
        watch.onSelectStations = { [weak self] from, to in
            Task { @MainActor in
                await self?.show(from: from, to: to)
            }
        }
        watch.onFilterExpress = { [weak self] pref in
            Task { @MainActor in
                await self?.setExpressPreference(pref)
            }
        }
    }

    // MARK: launch and routing

    func start() async {
        watch.activate()
        #if os(iOS) && canImport(ActivityKit)
        LiveActivityManager.shared.startMonitoring(backend: backend)
        #endif
        await loadStations()
        await route()
    }

    /// After launch and after every sign-in path: to the board, or to sign-in.
    func route() async {
        guard let s = backend.session else { phase = .signedOut; return }
        email = s.email
        do {
            let r = try await backend.settings()
            settings = r.settings
            settingsSaved = r.saved
            email = r.email ?? s.email
            phase = .ready
            expressPreference = settings.expressPreference
            await refresh()
            await registerForPushIfAllowed()
        } catch BackendError.notSignedIn {
            phase = .signedOut
        } catch let e as BackendError where e.isUnauthorized {
            backend.signOut()
            phase = .signedOut
        } catch {
            // Offline at launch: show what we can and retry on refresh.
            phase = .ready
            self.error = error.localizedDescription
        }
    }

    func loadStations() async {
        if let s = try? await backend.stations(), !s.isEmpty {
            stations = s
            UserDefaults.standard.set(try? JSONEncoder().encode(s), forKey: "stations")
        }
    }

    func stationName(_ id: String) -> String { stations.first { $0.id == id }?.name ?? id }

    // MARK: sign-in

    func signInWithGoogle(using session: WebAuthenticationSession) async {
        do {
            let (url, verifier) = backend.oauthStart(provider: "google", redirect: Self.authRedirect)
            let callback = try await session.authenticate(using: url, callbackURLScheme: "headway")
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

    func signOut() async {
        if let t = pushToken { try? await backend.unregisterPush(token: t) }
        #if os(iOS) && canImport(ActivityKit)
        await LiveActivityManager.shared.endCurrentActivity()
        await LiveActivityManager.shared.unpinBoard(backend: backend)
        pinnedBoard = nil
        #endif
        backend.signOut()
        board = nil
        tracked = nil
        settings = .defaults
        customPair = nil
        phase = .signedOut
        syncWatch()
    }

    func deleteData() async {
        do {
            try await backend.deleteData()
            #if os(iOS) && canImport(ActivityKit)
            await LiveActivityManager.shared.endCurrentActivity()
            await LiveActivityManager.shared.unpinBoard(backend: backend)
            pinnedBoard = nil
            #endif
            backend.signOut()
            board = nil
            tracked = nil
            settings = .defaults
            phase = .signedOut
            syncWatch()
        } catch { self.error = error.localizedDescription }
    }

    // MARK: board

    func syncWatch() {
        let state = WatchSyncState(
            session: backend.session,
            board: board,
            tracked: tracked,
            hasCommute: hasCommute,
            stations: stations,
            expressPreference: expressPreference
        )
        watch.sync(state: state)
    }

    func refresh() async {
        guard phase == .ready else { return }
        loading = true
        defer {
            loading = false
            syncWatch()
        }
        do {
            let r = try await backend.myBoard(from: customPair?.from, to: customPair?.to, express: expressPreference)
            board = r.board
            hasCommute = r.hasCommute
            tracked = r.tracked
            #if os(iOS) && canImport(ActivityKit)
            await LiveActivityManager.shared.syncTracked(tracked, backend: backend)
            await LiveActivityManager.shared.syncBoard(board)
            pinnedBoard = LiveActivityManager.shared.pinnedBoard.map { "\($0.fromId)>\($0.toId)" }
            #endif
            #if canImport(WidgetKit)
            WidgetCenter.shared.reloadTimelines(ofKind: "NextTrains")
            #endif
            error = nil
        } catch let e as BackendError where e.isUnauthorized || e == .notSignedIn {
            phase = .signedOut
        } catch {
            self.error = "Couldn't refresh: \(error.localizedDescription)"
        }
    }

    func setExpressPreference(_ pref: ExpressPreference) async {
        expressPreference = pref
        await refresh()
    }

    func show(from: String, to: String) async {
        customPair = (from, to)
        await refresh()
    }

    func flip() async {
        guard let b = board else { return }
        await show(from: b.to.id, to: b.from.id)
    }

    func showCommute() async {
        customPair = nil
        await refresh()
    }

    func track(_ t: BoardTrain) async {
        guard let b = board else { return }
        do {
            try await backend.track(Tracked(tripId: t.tripId, serviceDate: t.serviceDate, from: b.from.id, to: b.to.id))
            await refresh()
        } catch { self.error = error.localizedDescription }
    }

    func untrack() async {
        do {
            try await backend.untrack()
            #if os(iOS) && canImport(ActivityKit)
            await LiveActivityManager.shared.endCurrentActivity()
            #endif
            tracked = nil
            syncWatch()
        } catch { self.error = error.localizedDescription }
    }

    var boardIsPinned: Bool {
        guard let b = board else { return false }
        return pinnedBoard == "\(b.from.id)>\(b.to.id)"
    }

    /// Pins the board on screen to the Lock Screen, or unpins it.
    func togglePinBoard() async {
        #if os(iOS) && canImport(ActivityKit)
        let live = LiveActivityManager.shared
        if boardIsPinned {
            await live.unpinBoard(backend: backend)
        } else if let b = board {
            guard live.activitiesEnabled else {
                error = "Live Activities are off for Headway. Turn them on in Settings › Headway."
                return
            }
            do { try await live.pinBoard(b, backend: backend) } catch { self.error = error.localizedDescription }
        }
        pinnedBoard = live.pinnedBoard.map { "\($0.fromId)>\($0.toId)" }
        #endif
    }

    func shareEta(name: String? = nil) async throws -> EtaShareResponse {
        try await backend.createEtaShare(name: name)
    }

    // MARK: settings

    func save(_ s: Settings) async -> Bool {
        do {
            let r = try await backend.save(s)
            settings = r.settings
            settingsSaved = true
            await refresh()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    // MARK: push

    /// Asks for permission (once) and registers for remote notifications.
    func requestNotifications() async {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        notificationsAllowed = granted
        if granted { UIApplication.shared.registerForRemoteNotifications() }
    }

    func registerForPushIfAllowed() async {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        notificationsAllowed = status == .authorized || status == .provisional || status == .ephemeral ? true : status == .denied ? false : nil
        if notificationsAllowed == true { UIApplication.shared.registerForRemoteNotifications() }
    }

    func didRegister(deviceToken: Data) async {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        pushToken = token
        guard backend.session != nil else { return }
        do {
            try await backend.registerPush(token: token, sandbox: Self.isSandbox, label: UIDevice.current.name)
        } catch { self.error = "Couldn't turn on alerts: \(error.localizedDescription)" }
    }

    func sendTestAlert() async {
        do { try await backend.testPush() } catch { self.error = error.localizedDescription }
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
