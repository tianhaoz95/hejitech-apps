import AuthenticationServices
import FolioKit
import Observation
import SwiftUI
import UIKit

/// Where a notification tap or a link takes the app.
enum Destination: Hashable {
    case artifact(String)
    case suggestion(String, Int)
    case comments(String)
    case version(String, Int)
}

/// The app's state: who's signed in, the artifact list, the activity inbox, notification settings,
/// and navigation requests from notifications and links. One instance, shared with the app delegate
/// so notification buttons work while the app is in the background.
@MainActor
@Observable
final class AppModel {
    static let shared = AppModel()

    private(set) var config: ServerConfig
    private(set) var auth: SupabaseAuth
    private(set) var api: FolioAPI
    private(set) var session: AuthSession?

    var artifacts: [ArtifactSummary] = []
    var activity: [ActivityEvent] = []
    var loaded = false
    var listError: String?
    /// Set by notification taps and links; the home screen pushes it.
    var path = NavigationPath()
    var signInError: String?
    var busy = false
    var toast: String?
    /// The account's plan (GET /api/pro); nil until loaded or on servers before 0.3.0.
    var pro: ProStatus?
    /// Debug `-search <words>`: the home screen opens searching for them.
    var debugSearch: String?

    // Notifications
    var pushPrefs: PushPrefs
    var pushEnabled: Bool
    private(set) var pushToken: String?
    /// When the activity inbox was last opened (unread dot).
    var activitySeenAt: Date

    private let defaults = UserDefaults.standard

    private init() {
        let args = ProcessInfo.processInfo.arguments
        var cfg = ServerConfig.production
        #if DEBUG
        // -local [host]: the local stack on this Mac (simulator) or on the Mac at <host> (device).
        if let i = args.firstIndex(of: "-local") {
            let host = args.indices.contains(i + 1) && !args[i + 1].hasPrefix("-") ? args[i + 1] : "127.0.0.1"
            cfg = .local(host: host)
        }
        #endif
        config = cfg
        let a = SupabaseAuth(config: cfg)
        auth = a
        api = FolioAPI(auth: a)
        pushPrefs = (defaults.data(forKey: "pushPrefs")).flatMap { try? JSONDecoder().decode(PushPrefs.self, from: $0) } ?? PushPrefs()
        pushEnabled = defaults.bool(forKey: "pushEnabled")
        activitySeenAt = defaults.object(forKey: "activitySeenAt") as? Date ?? .distantPast
        // The Keychain outlives the app: a fresh install starts signed out.
        if !defaults.bool(forKey: "installed") {
            defaults.set(true, forKey: "installed")
            SessionVault().clear()
        }
        let saved = SessionVault().load()
        session = saved?.site == cfg.site.absoluteString ? saved : nil
        configurePurchases()
    }

    /// Purchases are made for the signed-in account (appAccountToken) and handed to the Worker.
    private func configurePurchases() {
        let store = ProPurchases.shared
        store.userId = { [weak self] in self?.session.flatMap { UUID(uuidString: $0.userId) } }
        store.sendToServer = { [weak self] jws in
            guard let self, self.session != nil else { return }
            let status = try await self.api.sendTransactions(jws)
            await MainActor.run { self.pro = status }
        }
    }

    func refreshPro() async {
        guard signedIn, let p = try? await api.pro() else { return }
        pro = p
    }

    var signedIn: Bool { session != nil }
    var email: String? { session?.email }
    var hasUnreadActivity: Bool { activity.contains { $0.created_at > activitySeenAt } }

    // MARK: sign-in

    func signInWithGoogle() async {
        signInError = nil
        let (url, verifier) = auth.oauthStart(provider: "google", redirect: "folio://login-callback")
        do {
            let callback = try await WebAuth.start(url: url, scheme: "folio")
            guard let code = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value else {
                signInError = "Google didn't finish signing you in. Try again."
                return
            }
            busy = true
            defer { busy = false }
            try await auth.exchangeCode(code, verifier: verifier)
            await didSignIn()
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            return
        } catch {
            signInError = error.localizedDescription
        }
    }

    func signInWithApple(_ result: Result<ASAuthorization, Error>) async {
        signInError = nil
        switch result {
        case .failure(let e):
            if (e as? ASAuthorizationError)?.code != .canceled { signInError = e.localizedDescription }
        case .success(let authz):
            guard let cred = authz.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = cred.identityToken, let token = String(data: tokenData, encoding: .utf8) else {
                signInError = "Apple didn't return a sign-in token. Try again."
                return
            }
            busy = true
            defer { busy = false }
            do {
                try await auth.signIn(provider: "apple", idToken: token)
                await didSignIn()
            } catch {
                signInError = error.localizedDescription
            }
        }
    }

    /// The App Review demo account (and the local one in Debug).
    func signInWithEmail(_ email: String, password: String) async throws {
        do {
            try await auth.reviewSignIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        } catch AuthError.http(let code, _) where code == 401 || code == 404 {
            throw AuthError.http(401, "")
        }
        await didSignIn()
    }

    private func didSignIn() async {
        session = await auth.current
        path = NavigationPath()
        await refresh()
        await ProPurchases.shared.syncToServer()
        if pushEnabled { await PushRelay.shared.refreshRegistration() }
    }

    func signOut() async {
        if let t = pushToken { try? await api.unregisterPush(token: t) }
        await auth.signOut()
        session = nil
        pro = nil
        artifacts = []
        activity = []
        loaded = false
        path = NavigationPath()
    }

    func deleteAllData() async throws {
        try await api.deleteAccountData()
        await signOut()
    }

    // MARK: data

    func refresh() async {
        // Its own task: SwiftUI cancels `.refreshable`/`.task` work when the view goes away.
        await Task { await load() }.value
    }

    private func load() async {
        guard await auth.current != nil else {
            session = nil
            return
        }
        do {
            async let list = api.artifacts()
            async let feed = api.activity()
            let (l, f) = try await (list, feed)
            artifacts = l
            activity = f.reversed()
            listError = nil
        } catch let e as APIError {
            listError = e.message
        } catch AuthError.notSignedIn {
            session = nil
        } catch {
            listError = error.localizedDescription
        }
        session = await auth.current
        loaded = true
    }

    // MARK: home screen actions

    /// Stars or unstars right away and saves in the background; puts it back if that fails.
    func toggleFavorite(_ a: ArtifactSummary) async {
        let on = !a.isFavorite
        setLocalFavorite(a.slug, on)
        do {
            try await api.setFavorite(a.slug, on)
        } catch {
            setLocalFavorite(a.slug, !on)
            flash(error.localizedDescription)
        }
    }

    private func setLocalFavorite(_ slug: String, _ on: Bool) {
        if let i = artifacts.firstIndex(where: { $0.slug == slug }) { artifacts[i].favorite = on }
    }

    /// Deletes an artifact you own, or leaves one shared with you.
    func removeFromList(_ a: ArtifactSummary) async {
        let before = artifacts
        artifacts.removeAll { $0.slug == a.slug }
        do {
            if a.role == .owner {
                try await api.delete(a.slug)
            } else if let me = session?.userId {
                try await api.removeMember(a.slug, userId: me)
            }
            flash(a.role == .owner ? "Deleted \"\(a.title)\"" : "Left \"\(a.title)\"")
        } catch {
            artifacts = before
            flash(error.localizedDescription)
        }
    }

    func markActivitySeen() {
        activitySeenAt = Date()
        defaults.set(activitySeenAt, forKey: "activitySeenAt")
    }

    func flash(_ text: String) {
        toast = text
        Task {
            try? await Task.sleep(for: .seconds(2.2))
            if toast == text { toast = nil }
        }
    }

    // MARK: links and notifications

    func open(_ d: Destination) {
        var p = NavigationPath()
        switch d {
        case .artifact(let slug):
            p.append(Destination.artifact(slug))
        case .suggestion(let slug, _), .comments(let slug), .version(let slug, _):
            p.append(Destination.artifact(slug))
            p.append(d)
        }
        path = p
    }

    /// `folio://a/<slug>`, `https://folio…/a/<slug>`, and invite links (`…/invite/#fiv_…`).
    func handle(url: URL) {
        if url.scheme == "folio", url.host == "login-callback" { return }
        if let token = Self.inviteToken(url) {
            Task { await acceptInvite(token) }
            return
        }
        let parts = (url.scheme == "folio" ? [url.host ?? ""] + url.pathComponents.filter { $0 != "/" } : url.pathComponents.filter { $0 != "/" })
        if parts.count >= 2, parts[0] == "a" { open(.artifact(parts[1])) }
    }

    static func inviteToken(_ url: URL) -> String? {
        if let f = url.fragment, f.hasPrefix("fiv_") { return f }
        let s = url.absoluteString
        if let r = s.range(of: "fiv_[A-Za-z0-9_-]+", options: .regularExpression) { return String(s[r]) }
        return nil
    }

    func acceptInvite(_ token: String) async {
        guard signedIn else {
            signInError = "Sign in, then open the invite link again."
            return
        }
        do {
            let slug = try await api.acceptInvite(token: token)
            await refresh()
            open(.artifact(slug))
        } catch {
            flash(error.localizedDescription)
        }
    }

    /// A notification was tapped: open what it's about.
    func openNotification(_ info: [AnyHashable: Any]) {
        guard let slug = info["slug"] as? String else { return }
        if let n = info["suggestion"] as? Int, (info["kind"] as? String)?.hasPrefix("suggest") == true {
            open(.suggestion(slug, n))
        } else if (info["kind"] as? String) == "commented" {
            if let n = info["suggestion"] as? Int { open(.suggestion(slug, n)) } else { open(.comments(slug)) }
        } else if let v = info["version"] as? Int {
            open(.version(slug, v))
        } else {
            open(.artifact(slug))
        }
        Task { await refresh() }
    }

    /// Accept / Reject / Reply from a notification, without opening the app.
    func performNotificationAction(_ action: String, info: [AnyHashable: Any], text: String?) async {
        guard let slug = info["slug"] as? String else { return }
        do {
            switch action {
            case PushRelay.accept:
                if let n = info["suggestion"] as? Int { try await api.review(slug, number: n, .accept) }
            case PushRelay.reject:
                if let n = info["suggestion"] as? Int { try await api.review(slug, number: n, .reject) }
            case PushRelay.reply:
                guard let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                if let id = info["comment"] as? String {
                    try await api.comment(slug, body: text, replyTo: id)
                } else {
                    try await api.comment(slug, body: text, suggestion: info["suggestion"] as? Int)
                }
            default:
                return
            }
        } catch {
            await PushRelay.shared.notifyFailure(error.localizedDescription)
        }
    }

    // MARK: notifications

    func setPushEnabled(_ on: Bool) async {
        if on {
            let granted = await PushRelay.shared.enable()
            pushEnabled = granted
            if !granted { flash("Allow notifications for Folio in Settings.") }
        } else {
            pushEnabled = false
            if let t = pushToken { try? await api.unregisterPush(token: t) }
        }
        defaults.set(pushEnabled, forKey: "pushEnabled")
    }

    func savePushPrefs() async {
        defaults.set(try? JSONEncoder().encode(pushPrefs), forKey: "pushPrefs")
        await registerToken()
    }

    func didReceive(pushToken token: String) {
        pushToken = token
        Task { await registerToken() }
    }

    private func registerToken() async {
        guard pushEnabled, signedIn, let t = pushToken else { return }
        #if DEBUG
        let sandbox = true
        #else
        let sandbox = false
        #endif
        _ = try? await api.registerPush(token: t, sandbox: sandbox, prefs: pushPrefs)
    }
}

/// Browser sign-in (Google) that returns to `folio://login-callback`.
@MainActor
enum WebAuth {
    private static var current: ASWebAuthenticationSession?
    private static let anchor = Anchor()

    final class Anchor: NSObject, ASWebAuthenticationPresentationContextProviding {
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
        }
    }

    static func start(url: URL, scheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { cont in
            let s = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callback, error in
                if let callback { cont.resume(returning: callback) } else { cont.resume(throwing: error ?? ASWebAuthenticationSessionError(.canceledLogin)) }
            }
            s.presentationContextProvider = anchor
            s.prefersEphemeralWebBrowserSession = false
            current = s
            s.start()
        }
    }
}
