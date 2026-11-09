import CryptoKit
import Foundation
import Security

/// Where the app talks to: HQ's Worker (every API call) and the shared Supabase project (sign-in
/// only). Release builds use production; Debug builds the local stack unless launched with
/// `-production`, or another HQ with `-serverURL <url>`.
struct BackendConfig: Hashable, Sendable {
    var site: URL
    var supabaseURL: URL
    var anonKey: String

    /// The hosted HQ Worker and the Supabase project every HEJI app shares (publishable key: safe to ship).
    static let production = BackendConfig(
        site: URL(string: "https://hq.hejitech.workers.dev")!,
        supabaseURL: URL(string: "https://jitdzllkxfhlrxxvljhp.supabase.co")!,
        anonKey: "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
    )

    /// `npm run dev:worker -w @hq/web` and `supabase start` on this Mac (the simulator reaches 127.0.0.1).
    static let local = BackendConfig(
        site: URL(string: "http://127.0.0.1:8799")!,
        supabaseURL: URL(string: "http://127.0.0.1:55421")!,
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )

    static var current: BackendConfig {
        #if DEBUG
        let d = UserDefaults.standard
        if d.bool(forKey: "production") { return .production }
        var c = BackendConfig.local
        if let s = d.string(forKey: "serverURL"), let u = URL(string: s) { c.site = u }
        if let s = d.string(forKey: "supabaseURL"), let u = URL(string: s) { c.supabaseURL = u }
        return c
        #else
        return .production
        #endif
    }
}

struct AuthSession: Codable, Hashable, Sendable {
    var accessToken: String
    var refreshToken: String
    var userId: String
    var email: String?
    var expiresAt: Date
}

struct APIError: LocalizedError {
    var status: Int
    var message: String
    var errorDescription: String? { message }
    var isUnauthorized: Bool { status == 401 }
}

/// The session lives in the Keychain; the chosen workspace in UserDefaults.
enum SessionStore {
    private static let service = "com.hejitech.hq"
    private static let account = "session"
    private static let wsKey = "hq.workspace"

    static func load() -> AuthSession? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecReturnData as String: true]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return try? JSONDecoder().decode(AuthSession.self, from: d)
    }

    static func save(_ s: AuthSession?) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(base as CFDictionary)
        guard let s, let d = try? JSONEncoder().encode(s) else { return }
        var add = base
        add[kSecValueData as String] = d
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static var workspaceId: String {
        get { UserDefaults.standard.string(forKey: wsKey) ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: wsKey) }
    }
}

/// Supabase Auth (GitHub and Google in the browser with PKCE, Apple with an identity token, email for
/// local accounts, refresh) and HQ's API with the session's access token. No SDK.
final class Backend: @unchecked Sendable {
    static let shared = Backend()

    let config = BackendConfig.current
    private let lock = NSLock()
    private var _session: AuthSession? = SessionStore.load()

    var session: AuthSession? {
        lock.lock(); defer { lock.unlock() }
        return _session
    }

    private func setSession(_ s: AuthSession?) {
        lock.lock(); _session = s; lock.unlock()
        SessionStore.save(s)
    }

    // MARK: auth

    /// Browser sign-in with PKCE: open `url` in a web authentication session that returns to
    /// `redirect`, then hand the callback's `code` and this `verifier` to `exchangeCode`.
    func oauthStart(provider: String, redirect: String) -> (url: URL, verifier: String) {
        let verifier = Self.randomURLSafe(bytes: 48)
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
        var c = URLComponents(url: config.supabaseURL.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        c.queryItems = [
            URLQueryItem(name: "provider", value: provider),
            URLQueryItem(name: "redirect_to", value: redirect),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "s256"),
        ]
        return (c.url!, verifier)
    }

    func exchangeCode(_ code: String, verifier: String) async throws {
        try await authRequest("token?grant_type=pkce", body: ["auth_code": code, "code_verifier": verifier])
    }

    func signIn(provider: String, idToken: String, nonce: String? = nil) async throws {
        var body = ["provider": provider, "id_token": idToken]
        if let nonce { body["nonce"] = nonce }
        try await authRequest("token?grant_type=id_token", body: body)
    }

    /// Email and password: local accounts only (Debug builds against `supabase start`).
    func signIn(email: String, password: String) async throws {
        try await authRequest("token?grant_type=password", body: ["email": email, "password": password])
    }

    func signOut() {
        setSession(nil)
        SessionStore.workspaceId = ""
    }

    func refreshIfNeeded() async throws {
        guard let s = session else { throw APIError(status: 401, message: "Not signed in") }
        if s.expiresAt.timeIntervalSinceNow > 60 { return }
        do {
            try await authRequest("token?grant_type=refresh_token", body: ["refresh_token": s.refreshToken])
        } catch let e as APIError where e.status == 400 || e.status == 401 {
            setSession(nil)
            throw APIError(status: 401, message: "Your session expired. Sign in again.")
        }
    }

    private func authRequest(_ path: String, body: [String: String]) async throws {
        var req = URLRequest(url: URL(string: "\(config.supabaseURL.absoluteString)/auth/v1/\(path)")!)
        req.httpMethod = "POST"
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw APIError(status: code, message: (obj?["error_description"] ?? obj?["msg"] ?? obj?["error"]) as? String ?? "Sign-in failed (\(code))")
        }
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = obj["access_token"] as? String, let refresh = obj["refresh_token"] as? String,
              let user = obj["user"] as? [String: Any], let id = user["id"] as? String else {
            throw APIError(status: 0, message: "Unexpected sign-in response")
        }
        let expires = (obj["expires_in"] as? Double) ?? 3600
        setSession(AuthSession(accessToken: access, refreshToken: refresh, userId: id, email: user["email"] as? String, expiresAt: Date().addingTimeInterval(expires)))
    }

    static func randomURLSafe(bytes: Int) -> String {
        var rng = SystemRandomNumberGenerator()
        return Data((0..<bytes).map { _ in UInt8.random(in: .min ... .max, using: &rng) }).base64URL
    }

    // MARK: API

    /// `path` starting with "~/" is in the current workspace (`/api/w/<id>/…`).
    func request(_ method: String, _ path: String, body: [String: Any]? = nil) async throws -> Data {
        try await refreshIfNeeded()
        let full = path.hasPrefix("~/") ? "/api/w/\(SessionStore.workspaceId)/\(path.dropFirst(2))" : path
        guard let url = URL(string: config.site.absoluteString + full) else { throw APIError(status: 0, message: "Invalid URL") }
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.httpMethod = method
        req.setValue("Bearer \(session?.accessToken ?? "")", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            var msg = obj?["error"] as? String ?? "HTTP \(status)"
            if let details = obj?["details"] as? [String], !details.isEmpty { msg += ": " + details.joined(separator: "; ") }
            throw APIError(status: status, message: msg)
        }
        return data
    }

    func get<T: Decodable>(_ path: String) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await request("GET", path))
    }
}

extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
