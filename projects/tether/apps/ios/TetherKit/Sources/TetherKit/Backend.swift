import CryptoKit
import Foundation

/// Where Tether talks to: the Tether Worker (every API call) and the shared Supabase project
/// (sign-in only). Release builds use production; Debug builds use the local stack unless launched
/// with `-production`.
public struct BackendConfig: Hashable, Sendable {
    public var site: URL
    public var supabaseURL: URL
    public var anonKey: String

    public init(site: URL, supabaseURL: URL, anonKey: String) {
        self.site = site
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
    }

    /// The hosted Tether Worker and the Supabase project every HEJI app shares (publishable key: safe to ship).
    public static let production = BackendConfig(
        site: URL(string: "https://tether.hejitech.workers.dev")!,
        supabaseURL: URL(string: "https://jitdzllkxfhlrxxvljhp.supabase.co")!,
        anonKey: "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
    )

    /// `npm run dev:worker -w @tether/web` and `supabase start` on this Mac (the simulator reaches 127.0.0.1).
    public static let local = BackendConfig(
        site: URL(string: "http://127.0.0.1:8796")!,
        supabaseURL: URL(string: "http://127.0.0.1:55421")!,
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )
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

public enum BackendError: Error, LocalizedError, Equatable {
    case http(Int, String)
    case notSignedIn
    case decode(String)
    case secretRejected(String)

    public var errorDescription: String? {
        switch self {
        case .http(_, let body):
            if let data = body.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let e = obj["error"] as? String {
                return e
            }
            return "Server error: \(body.prefix(160))"
        case .notSignedIn:
            return "Not signed in"
        case .decode(let s):
            return "Unexpected server response: \(s)"
        case .secretRejected(let field):
            return "Security policy (PRD §14): secret field '\(field)' may not be synced."
        }
    }

    public var isUnauthorized: Bool {
        if case .http(401, _) = self { return true }
        return false
    }
}

/// Supabase Auth (Google through the browser with PKCE, Apple with an identity token, refresh) and
/// the Worker's API with the session's access token. No SDK.
public final class Backend: @unchecked Sendable {
    public let config: BackendConfig
    private let http: URLSession
    private let lock = NSLock()
    private var _session: AuthSession?
    public var onSessionChange: ((AuthSession?) -> Void)?

    public init(config: BackendConfig, session: AuthSession? = nil, http: URLSession = .shared) {
        self.config = config
        self._session = session
        self.http = http
    }

    public var session: AuthSession? {
        lock.lock(); defer { lock.unlock() }
        return _session
    }

    private func setSession(_ s: AuthSession?) {
        lock.lock(); _session = s; lock.unlock()
        onSessionChange?(s)
    }

    // MARK: Auth

    public func oauthStart(provider: String, redirect: String) -> (url: URL, verifier: String) {
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

    @discardableResult
    public func exchangeCode(_ code: String, verifier: String) async throws -> AuthSession {
        try await authRequest("token?grant_type=pkce", body: ["auth_code": code, "code_verifier": verifier])
    }

    @discardableResult
    public func signIn(provider: String, idToken: String, nonce: String? = nil) async throws -> AuthSession {
        var body = ["provider": provider, "id_token": idToken]
        if let nonce { body["nonce"] = nonce }
        return try await authRequest("token?grant_type=id_token", body: body)
    }

    @discardableResult
    public func signIn(email: String, password: String) async throws -> AuthSession {
        try await authRequest("token?grant_type=password", body: ["email": email, "password": password])
    }

    public func signOut() {
        setSession(nil)
    }

    public func refreshIfNeeded() async throws {
        guard let s = session else { throw BackendError.notSignedIn }
        if s.expiresAt.timeIntervalSinceNow > 60 { return }
        do {
            try await authRequest("token?grant_type=refresh_token", body: ["refresh_token": s.refreshToken])
        } catch let e as BackendError where e.isUnauthorized || { if case .http(400, _) = e { return true }; return false }() {
            setSession(nil)
            throw BackendError.notSignedIn
        }
    }

    @discardableResult
    private func authRequest(_ path: String, body: [String: String]) async throws -> AuthSession {
        var req = URLRequest(url: URL(string: "\(config.supabaseURL.absoluteString)/auth/v1/\(path)")!)
        req.httpMethod = "POST"
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = obj["access_token"] as? String,
              let refresh = obj["refresh_token"] as? String,
              let user = obj["user"] as? [String: Any],
              let id = user["id"] as? String else {
            throw BackendError.decode(String(decoding: data.prefix(200), as: UTF8.self))
        }
        let expires = (obj["expires_in"] as? Double) ?? 3600
        let s = AuthSession(
            accessToken: access,
            refreshToken: refresh,
            userId: id,
            email: user["email"] as? String,
            expiresAt: Date().addingTimeInterval(expires)
        )
        setSession(s)
        return s
    }

    static func check(_ resp: URLResponse, _ data: Data) throws {
        let code = (resp as? HTTPURLResponse)?.statusCode ?? -1
        guard (200..<300).contains(code) else {
            throw BackendError.http(code, String(decoding: data, as: UTF8.self))
        }
    }

    static func randomURLSafe(bytes: Int) -> String {
        var rng = SystemRandomNumberGenerator()
        return Data((0..<bytes).map { _ in UInt8.random(in: .min ... .max, using: &rng) }).base64URL
    }

    // MARK: Worker API

    public static let decoder = JSONDecoder()
    public static let encoder = JSONEncoder()

    public func call<T: Decodable>(
        _ method: String,
        _ path: String,
        body: (some Encodable)? = Optional<Int>.none,
        auth: Bool = true,
        as: T.Type = T.self
    ) async throws -> T {
        var req = URLRequest(url: URL(string: config.site.absoluteString + path)!)
        req.httpMethod = method
        req.timeoutInterval = 15
        req.setValue("ios", forHTTPHeaderField: "X-Tether-Client")
        if auth {
            try await refreshIfNeeded()
            guard let s = session else { throw BackendError.notSignedIn }
            req.setValue("Bearer \(s.accessToken)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            let encoded = try Self.encoder.encode(body)
            if let jsonObj = try? JSONSerialization.jsonObject(with: encoded),
               let forbidden = PaneTreeOps.findForbiddenSecretPath(in: jsonObj) {
                throw BackendError.secretRejected(forbidden)
            }
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = encoded
        }
        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        do {
            return try Self.decoder.decode(T.self, from: data)
        } catch {
            throw BackendError.decode("\(error)".prefix(200).description)
        }
    }

    public struct OK: Decodable, Sendable {}

    public func fetchWorkspace() async throws -> WorkspaceSnapshot {
        try await call("GET", "/api/workspace")
    }

    public func saveWorkspace(tree: PaneTree, settings: TetherSettings) async throws -> WorkspaceSnapshot {
        struct Body: Encodable {
            let tree: PaneTree
            let settings: TetherSettings
        }
        return try await call("PUT", "/api/workspace", body: Body(tree: tree, settings: settings))
    }

    public func fetchHosts() async throws -> [SshHost] {
        struct Resp: Decodable { let hosts: [SshHost] }
        return try await call("GET", "/api/hosts", as: Resp.self).hosts
    }

    public func saveHost(_ host: SshHost) async throws -> [SshHost] {
        struct Resp: Decodable { let hosts: [SshHost] }
        return try await call("POST", "/api/hosts", body: host, as: Resp.self).hosts
    }

    public func deleteHost(_ id: String) async throws -> [SshHost] {
        struct Resp: Decodable { let hosts: [SshHost] }
        return try await call("DELETE", "/api/hosts/\(id)", as: Resp.self).hosts
    }

    public func fetchBookmarks() async throws -> [Bookmark] {
        struct Resp: Decodable { let bookmarks: [Bookmark] }
        return try await call("GET", "/api/bookmarks", as: Resp.self).bookmarks
    }

    public func saveBookmark(_ bookmark: Bookmark) async throws -> [Bookmark] {
        struct Resp: Decodable { let bookmarks: [Bookmark] }
        return try await call("POST", "/api/bookmarks", body: bookmark, as: Resp.self).bookmarks
    }

    public func deleteBookmark(_ id: String) async throws -> [Bookmark] {
        struct Resp: Decodable { let bookmarks: [Bookmark] }
        return try await call("DELETE", "/api/bookmarks/\(id)", as: Resp.self).bookmarks
    }

    public func deleteAccount() async throws {
        let _: OK = try await call("DELETE", "/api/account")
    }
}

extension Data {
    var base64URL: String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
