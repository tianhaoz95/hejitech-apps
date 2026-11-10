import AuthenticationServices
import Foundation
import Security
import SwiftUI
import G2DigestKit

public enum ReaderViewMode: String, CaseIterable, Identifiable {
    case native = "Native"
    case hud = "G2 Glasses HUD"

    public var id: String { rawValue }
}

@MainActor
public final class AppModel: ObservableObject {
    public static let defaultServerURL = URL(string: "https://g2digest.hejitech.workers.dev")!
    /// Where Supabase sends the browser back after Google sign-in (allow-listed in the shared project).
    public static let authRedirect = "g2digest://login-callback"

    @Published public var currentBundle: BundleData?
    @Published public var signedAudioMap: [String: String] = [:]
    @Published public var currentCardIndex: Int = 0
    @Published public var viewMode: ReaderViewMode = .native {
        didSet {
            UserDefaults.standard.set(viewMode.rawValue, forKey: "g2digest_view_mode")
        }
    }
    @Published public var editions: [EditionSummary] = []
    /// Signed in with Apple or Google: the web app's account, on the phone.
    @Published public private(set) var account: AuthSession?
    /// Paired with a code instead (reads editions only).
    @Published public var isPaired: Bool = false
    @Published public var isOffline: Bool = false
    @Published public var isLoading: Bool = false
    @Published public var errorMessage: String?
    @Published public var showPairingSheet: Bool = false
    @Published public var showHistorySheet: Bool = false
    @Published public var showBriefSheet: Bool = false
    @Published public var showSettingsSheet: Bool = false
    @Published public var showWhatsNewSheet: Bool = false
    @Published public var userBrief: Brief?
    @Published public var devices: [PairedDevice] = []

    public var isSignedIn: Bool { account != nil }
    /// Signed in or paired: there is an account to read editions from.
    public var hasAccess: Bool { isSignedIn || isPaired }

    private var api: G2DigestAPI
    private var auth: SupabaseAuth
    private let tokenKey = "g2digest_device_token"
    private let serverURLKey = "g2digest_server_url"

    public init() {
        // The Keychain outlives the app: a fresh install must not pick up a previous install's session.
        if !UserDefaults.standard.bool(forKey: "g2digest_installed") {
            KeychainStore.set(nil, for: "session")
            UserDefaults.standard.set(true, forKey: "g2digest_installed")
        }
        let savedURL = UserDefaults.standard.string(forKey: serverURLKey)
            .flatMap { URL(string: $0) } ?? Self.defaultServerURL
        let savedToken = UserDefaults.standard.string(forKey: tokenKey)
        let savedSession = KeychainStore.get("session").flatMap { try? JSONDecoder().decode(AuthSession.self, from: $0) }

        self.api = G2DigestAPI(baseURL: savedURL, token: savedToken)
        self.auth = SupabaseAuth(config: .forServer(savedURL), session: savedSession)
        self.account = savedSession
        self.isPaired = (savedToken?.isEmpty == false)

        if let savedMode = UserDefaults.standard.string(forKey: "g2digest_view_mode"),
           let mode = ReaderViewMode(rawValue: savedMode) {
            self.viewMode = mode
        }

        wireAuth()
        // The built-in tour until the first refresh brings an edition.
        self.currentBundle = TourBuilder.makeTour(reason: hasAccess ? .waiting : .pair)
    }

    /// Persists session changes (sign-in, refresh, a refused refresh) and gives the API the token.
    private func wireAuth() {
        let config = auth.config
        let current = account
        auth = SupabaseAuth(config: config, session: current, onChange: { [weak self] s in
            KeychainStore.set(s.flatMap { try? JSONEncoder().encode($0) }, for: "session")
            Task { @MainActor in self?.account = s }
        })
        let auth = self.auth
        let api = self.api
        Task { await api.setAccessTokenProvider { try await auth.accessToken() } }
    }

    public var currentCard: CardInput? {
        guard let bundle = currentBundle,
              currentCardIndex >= 0 && currentCardIndex < bundle.cards.count else {
            return nil
        }
        return bundle.cards[currentCardIndex]
    }

    public func updateServerURL(_ newURL: URL) {
        UserDefaults.standard.set(newURL.absoluteString, forKey: serverURLKey)
        let token = UserDefaults.standard.string(forKey: tokenKey)
        self.api = G2DigestAPI(baseURL: newURL, token: token)
        if AuthConfig.forServer(newURL) != auth.config {
            // Another stack's session is no good here.
            account = nil
            KeychainStore.set(nil, for: "session")
            auth = SupabaseAuth(config: .forServer(newURL))
        }
        wireAuth()
        Task { await refreshAll() }
    }

    // MARK: sign-in

    public func signInWithApple(_ result: Result<ASAuthorization, Error>) async {
        errorMessage = nil
        do {
            guard case .success(let authorization) = result,
                  let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let token = cred.identityToken.flatMap({ String(data: $0, encoding: .utf8) }) else {
                if case .failure(let e) = result, (e as? ASAuthorizationError)?.code == .canceled { return }
                if case .failure(let e) = result { throw e }
                return
            }
            try await auth.signIn(provider: "apple", idToken: token)
            await didSignIn()
        } catch {
            errorMessage = "Apple sign-in failed: \(error.localizedDescription)"
        }
    }

    public func signInWithGoogle(using webAuth: WebAuthenticationSession) async {
        errorMessage = nil
        do {
            let (url, verifier) = auth.oauthStart(provider: "google", redirect: Self.authRedirect)
            let callback = try await webAuth.authenticate(using: url, callbackURLScheme: "g2digest")
            let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
            guard let code = items.first(where: { $0.name == "code" })?.value else {
                let reason = items.first(where: { $0.name == "error_description" })?.value ?? "no code in the callback"
                throw AuthError.decode(reason.replacingOccurrences(of: "+", with: " "))
            }
            try await auth.exchangeCode(code, verifier: verifier)
            await didSignIn()
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            return
        } catch {
            errorMessage = "Google sign-in failed: \(error.localizedDescription)"
        }
    }

    #if DEBUG
    /// The local seed account (reader@example.com / g2digest-dev) against the local stack.
    public func signInWithSeed(email: String, password: String) async {
        do {
            try await auth.signIn(email: email, password: password)
            await didSignIn()
        } catch { errorMessage = error.localizedDescription }
    }
    #endif

    private func didSignIn() async {
        account = await auth.current
        showPairingSheet = false
        await refreshAll()
    }

    public func signOut() async {
        await auth.signOut()
        account = nil
        devices = []
        if !isPaired { resetToTour() } else { await refreshAll() }
    }

    /// Delete all my G2 Digest data, then sign out (the HEJI sign-in itself stays, as on the web).
    public func deleteAllData() async -> Bool {
        do {
            try await api.deleteAllData()
            unpair()
            await signOut()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    // MARK: pairing (this phone with a code, or glasses from a signed-in phone)

    public func saveToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
        self.isPaired = true
        Task {
            await api.setToken(token)
            await refreshAll()
        }
    }

    public func unpair() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
        self.isPaired = false
        Task { await api.setToken(nil) }
        if !isSignedIn { resetToTour() }
    }

    public func redeemCode(_ code: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let result = try await api.redeemPairingCode(code: code)
            saveToken(result.deviceToken)
            return true
        } catch {
            self.errorMessage = error.localizedDescription
            return false
        }
    }

    public func newPairingCode() async -> PairingCode? {
        do { return try await api.createPairingCode() } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    public func loadDevices() async {
        guard isSignedIn else { return }
        do { devices = try await api.fetchDevices() } catch { errorMessage = error.localizedDescription }
    }

    public func revokeDevice(_ d: PairedDevice) async {
        do {
            try await api.revokeDevice(id: d.id)
            devices.removeAll { $0.id == d.id }
        } catch { errorMessage = error.localizedDescription }
    }

    private func resetToTour() {
        editions = []
        signedAudioMap = [:]
        userBrief = nil
        devices = []
        currentBundle = TourBuilder.makeTour(reason: .pair)
        currentCardIndex = 0
    }

    // MARK: cards

    public func nextCard() {
        guard let bundle = currentBundle else { return }
        if currentCardIndex + 1 < bundle.cards.count {
            currentCardIndex += 1
        }
    }

    public func prevCard() {
        if currentCardIndex > 0 {
            currentCardIndex -= 1
        }
    }

    public func goToCard(index: Int) {
        guard let bundle = currentBundle else { return }
        if index >= 0 && index < bundle.cards.count {
            currentCardIndex = index
        }
    }

    // MARK: sync

    /// Fetches the editions list, the edition on screen (or the latest) and, signed in, the brief.
    /// Each part stands on its own: a missing latest edition or a refused brief never hides the list.
    public func refreshAll() async {
        guard hasAccess else {
            resetToTour()
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        // Stay on the edition being read; otherwise open the newest.
        let showing = TourBuilder.isTour(currentBundle) ? nil : currentBundle?.date

        do {
            let list = try await api.fetchEditions()
            editions = list
            isOffline = false

            let target = showing.flatMap { d in list.contains { $0.date == d } ? d : nil } ?? list.first?.date
            if let target {
                let res = try await api.fetchEdition(date: target)
                if target != showing { currentCardIndex = 0 }
                apply(res)
            } else {
                currentBundle = TourBuilder.makeTour(reason: .waiting)
                currentCardIndex = 0
            }
        } catch APIError.unauthenticated {
            // The device token was revoked, or the session ended.
            if isPaired && !isSignedIn { unpair() }
            errorMessage = APIError.unauthenticated.errorDescription
        } catch let e as APIError {
            if case .networkError = e { isOffline = true }
            errorMessage = e.localizedDescription
            if currentBundle == nil {
                currentBundle = TourBuilder.makeTour(reason: .offline)
                currentCardIndex = 0
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        if isSignedIn {
            userBrief = try? await api.fetchBrief()
            await loadDevices()
        } else {
            userBrief = nil
        }
    }

    public func loadEdition(date: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            apply(try await api.fetchEdition(date: date))
            currentCardIndex = 0
        } catch {
            self.errorMessage = "Couldn't open the \(date) edition: \(error.localizedDescription)"
        }
    }

    private func apply(_ res: EditionResponse) {
        currentBundle = res.bundle
        signedAudioMap = res.audio ?? [:]
        AudioPlayerService.shared.updateSignedAudioMap(signedAudioMap)
        if currentCardIndex >= res.bundle.cards.count { currentCardIndex = 0 }
    }
}

/// The signed-in session, in the Keychain (this device only).
enum KeychainStore {
    private static let service = "com.hejitech.g2digest"

    static func get(_ key: String) -> Data? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: key, kSecReturnData as String: true]
        var out: AnyObject?
        return SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }

    static func set(_ data: Data?, for key: String) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: key]
        SecItemDelete(q as CFDictionary)
        guard let data else { return }
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}
