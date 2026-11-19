import CryptoKit
import Foundation

/// Where the app talks to: the Folio Worker (every data call) and the shared Supabase project's auth
/// (sign-in only). Release builds use production; Debug builds can point both at the local stack.
public struct ServerConfig: Hashable, Sendable {
    public var site: URL
    public var supabaseURL: URL
    public var anonKey: String

    public init(site: URL, supabaseURL: URL, anonKey: String) {
        self.site = site
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
    }

    /// The Supabase project every HEJI app shares (publishable key: safe to ship).
    public static let production = ServerConfig(
        site: URL(string: "https://folio.hejitech.workers.dev")!,
        supabaseURL: URL(string: "https://jitdzllkxfhlrxxvljhp.supabase.co")!,
        anonKey: "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
    )

    /// `supabase start` and `npm run dev:worker -w @folio/web` on a Mac (`host` is its address).
    public static func local(host: String = "127.0.0.1") -> ServerConfig {
        ServerConfig(
            site: URL(string: "http://\(host):8801")!,
            supabaseURL: URL(string: "http://\(host):55421")!,
            anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        )
    }

    public var isLocal: Bool { site.scheme == "http" }
    public var mcpURL: URL { site.appendingPathComponent("mcp") }
}

public struct AuthSession: Codable, Hashable, Sendable {
    public var accessToken: String
    public var refreshToken: String
    public var userId: String
    public var email: String?
    public var expiresAt: Date
    /// The site the session belongs to (a local session never goes to production).
    public var site: String?

    public init(accessToken: String, refreshToken: String, userId: String, email: String?, expiresAt: Date, site: String? = nil) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.userId = userId
        self.email = email
        self.expiresAt = expiresAt
        self.site = site
    }
}

public enum AuthError: LocalizedError, Equatable, Sendable {
    case http(Int, String)
    case notSignedIn
    case decode(String)

    public var errorDescription: String? {
        switch self {
        case .http(let code, let body):
            if code == 401 { return "Wrong email or password." }
            if let data = body.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let m = (obj["error_description"] ?? obj["msg"] ?? obj["error"]) as? String {
                return m
            }
            return "Sign-in failed (\(code))."
        case .notSignedIn: return "You're signed out. Sign in again."
        case .decode: return "Sign-in returned something unexpected. Try again."
        }
    }
}

/// Supabase Auth without the SDK: Google through the browser with PKCE, Apple with an identity
/// token, the App Review demo account through the Worker, and refresh. Every change is saved to the
/// shared Keychain group, so the Share extension signs in as the app does.
public actor SupabaseAuth {
    public nonisolated let config: ServerConfig
    private let http: URLSession
    private let vault: SessionVault
    private var session: AuthSession?
    private var refreshing: Task<AuthSession, Error>?

    public init(config: ServerConfig, vault: SessionVault = SessionVault(), http: URLSession = .shared) {
        self.config = config
        self.vault = vault
        self.http = http
        let saved = vault.load()
        session = saved?.site == config.site.absoluteString ? saved : nil
    }

    public var current: AuthSession? { session }

    private func setSession(_ s: AuthSession?) {
        session = s
        if let s { vault.save(s) } else { vault.clear() }
    }

    /// Browser sign-in with PKCE: open `url` in a web authentication session that returns to
    /// `redirect`, then hand the callback's `code` and this `verifier` to `exchangeCode`.
    public nonisolated func oauthStart(provider: String, redirect: String) -> (url: URL, verifier: String) {
        let verifier = Self.randomURLSafe(bytes: 48)
        let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var c = URLComponents(url: config.supabaseURL.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        c.queryItems = [
            URLQueryItem(name: "provider", value: provider),
            URLQueryItem(name: "redirect_to", value: redirect),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "s256"),
        ]
        return (c.url!, verifier)
    }

    @discardableResult
    public func exchangeCode(_ code: String, verifier: String) async throws -> AuthSession {
        try await tokenRequest("pkce", ["auth_code": code, "code_verifier": verifier])
    }

    /// Sign in with Apple's identity token (the native sheet).
    @discardableResult
    public func signIn(provider: String, idToken: String, nonce: String? = nil) async throws -> AuthSession {
        var body = ["provider": provider, "id_token": idToken]
        if let nonce { body["nonce"] = nonce }
        return try await tokenRequest("id_token", body)
    }

    /// The App Review demo account: the Worker checks it and returns a normal Supabase session.
    @discardableResult
    public func reviewSignIn(email: String, password: String) async throws -> AuthSession {
        var req = URLRequest(url: config.site.appendingPathComponent("api/review-sign-in"))
        req.httpMethod = "POST"
        req.timeoutInterval = 30
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        return try await send(req)
    }

    public func signOut() { setSession(nil) }

    /// A current access token, refreshed when it's about to expire; nil when signed out. A refused
    /// refresh token signs out. Concurrent callers share one refresh.
    public func accessToken() async throws -> String? {
        guard let s = session else { return nil }
        if s.expiresAt.timeIntervalSinceNow > 60 { return s.accessToken }
        return try await refresh().accessToken
    }

    /// Refreshes now (after the Worker said 401, or when the token is about to expire).
    @discardableResult
    public func refresh() async throws -> AuthSession {
        if let refreshing { return try await refreshing.value }
        guard let s = session else { throw AuthError.notSignedIn }
        // The extension may have refreshed (and so rotated the refresh token) since we loaded it.
        let latest = vault.load().flatMap { $0.userId == s.userId && $0.site == s.site ? $0 : nil } ?? s
        if latest.expiresAt.timeIntervalSinceNow > 60, latest.accessToken != s.accessToken {
            session = latest
            return latest
        }
        let task = Task { () throws -> AuthSession in
            try await tokenRequest("refresh_token", ["refresh_token": latest.refreshToken])
        }
        refreshing = task
        defer { refreshing = nil }
        do {
            return try await task.value
        } catch let AuthError.http(code, _) where code == 400 || code == 401 {
            setSession(nil)
            throw AuthError.notSignedIn
        }
    }

    @discardableResult
    private func tokenRequest(_ grant: String, _ body: [String: String]) async throws -> AuthSession {
        var req = URLRequest(url: URL(string: "\(config.supabaseURL.absoluteString)/auth/v1/token?grant_type=\(grant)")!)
        req.httpMethod = "POST"
        req.timeoutInterval = 20
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(req)
    }

    private func send(_ req: URLRequest) async throws -> AuthSession {
        let (data, resp) = try await http.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? -1
        guard (200..<300).contains(code) else { throw AuthError.http(code, String(decoding: data, as: UTF8.self)) }
        var s = try Self.parseSession(data)
        s.site = config.site.absoluteString
        setSession(s)
        return s
    }

    /// A session from a Supabase token response (`access_token`, `refresh_token`, `user`, …).
    public static func parseSession(_ data: Data, now: Date = Date()) throws -> AuthSession {
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = obj["access_token"] as? String, let refresh = obj["refresh_token"] as? String,
              let user = obj["user"] as? [String: Any], let id = user["id"] as? String else {
            throw AuthError.decode(String(decoding: data.prefix(200), as: UTF8.self))
        }
        let expires = (obj["expires_in"] as? Double) ?? 3600
        return AuthSession(accessToken: access, refreshToken: refresh, userId: id,
                           email: user["email"] as? String, expiresAt: now.addingTimeInterval(expires))
    }

    public static func randomURLSafe(bytes: Int) -> String {
        var rng = SystemRandomNumberGenerator()
        return base64URL(Data((0..<bytes).map { _ in UInt8.random(in: .min ... .max, using: &rng) }))
    }

    static func base64URL(_ d: Data) -> String {
        d.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
