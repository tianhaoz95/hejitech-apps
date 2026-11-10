import CryptoKit
import Foundation

/// The shared Supabase project's auth endpoint (sign-in only; every data call goes to the Worker).
/// Release builds use production; a Worker on 127.0.0.1 pairs with the local stack.
public struct AuthConfig: Hashable, Sendable {
    public var supabaseURL: URL
    public var anonKey: String

    public init(supabaseURL: URL, anonKey: String) {
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
    }

    /// The Supabase project every HEJI app shares (publishable key: safe to ship).
    public static let production = AuthConfig(
        supabaseURL: URL(string: "https://jitdzllkxfhlrxxvljhp.supabase.co")!,
        anonKey: "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
    )

    /// `supabase start` on this Mac (the simulator reaches 127.0.0.1).
    public static let local = AuthConfig(
        supabaseURL: URL(string: "http://127.0.0.1:55421")!,
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )

    /// The auth project that goes with a Worker URL.
    public static func forServer(_ server: URL) -> AuthConfig {
        ["127.0.0.1", "localhost"].contains(server.host ?? "") ? .local : .production
    }
}

public struct AuthSession: Codable, Hashable, Sendable {
    public var accessToken: String
    public var refreshToken: String
    public var userId: String
    public var email: String?
    public var expiresAt: Date

    public init(accessToken: String, refreshToken: String, userId: String, email: String?, expiresAt: Date) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.userId = userId
        self.email = email
        self.expiresAt = expiresAt
    }
}

public enum AuthError: LocalizedError, Equatable, Sendable {
    case http(Int, String)
    case notSignedIn
    case decode(String)

    public var errorDescription: String? {
        switch self {
        case .http(_, let body):
            if let data = body.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let m = (obj["error_description"] ?? obj["msg"] ?? obj["error"]) as? String { return m }
            }
            return "Sign-in failed: \(body.prefix(160))"
        case .notSignedIn: return "Not signed in"
        case .decode(let s): return "Unexpected sign-in response: \(s)"
        }
    }
}

/// Supabase Auth without the SDK: Google through the browser with PKCE, Apple with an identity
/// token, and refresh. The session is the same kind the web app keeps, so the Worker treats this
/// iPhone like the web app (brief, devices, pairing codes, editions).
public actor SupabaseAuth {
    public nonisolated let config: AuthConfig
    private let http: URLSession
    private var session: AuthSession?
    private let onChange: @Sendable (AuthSession?) -> Void

    public init(config: AuthConfig, session: AuthSession? = nil, http: URLSession = .shared,
                onChange: @escaping @Sendable (AuthSession?) -> Void = { _ in }) {
        self.config = config
        self.session = session
        self.http = http
        self.onChange = onChange
    }

    public var current: AuthSession? { session }

    private func setSession(_ s: AuthSession?) {
        session = s
        onChange(s)
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

    /// Email and password: the local seed account only (Debug builds).
    @discardableResult
    public func signIn(email: String, password: String) async throws -> AuthSession {
        try await tokenRequest("password", ["email": email, "password": password])
    }

    public func signOut() { setSession(nil) }

    /// A current access token, refreshed when it's about to expire; nil when signed out. A refused
    /// refresh token signs out.
    public func accessToken() async throws -> String? {
        guard let s = session else { return nil }
        if s.expiresAt.timeIntervalSinceNow > 60 { return s.accessToken }
        do {
            return try await tokenRequest("refresh_token", ["refresh_token": s.refreshToken]).accessToken
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
        let (data, resp) = try await http.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? -1
        guard (200..<300).contains(code) else { throw AuthError.http(code, String(decoding: data, as: UTF8.self)) }
        let s = try Self.parseSession(data)
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

    static func randomURLSafe(bytes: Int) -> String {
        var rng = SystemRandomNumberGenerator()
        return base64URL(Data((0..<bytes).map { _ in UInt8.random(in: .min ... .max, using: &rng) }))
    }

    static func base64URL(_ d: Data) -> String {
        d.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
