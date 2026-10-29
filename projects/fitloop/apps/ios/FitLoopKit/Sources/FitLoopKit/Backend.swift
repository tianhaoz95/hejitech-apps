import CryptoKit
import Foundation

/// Where the app talks to: the FitLoop Worker (every API call) and the shared Supabase project
/// (sign-in only). Release builds use production; Debug builds the local stack unless launched with
/// `-production`.
public struct BackendConfig: Hashable, Sendable {
    public var site: URL
    public var supabaseURL: URL
    public var anonKey: String

    public init(site: URL, supabaseURL: URL, anonKey: String) {
        self.site = site
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
    }

    /// The hosted FitLoop Worker and the Supabase project every HEJI app shares (publishable key: safe to ship).
    public static let production = BackendConfig(
        site: URL(string: "https://fitloop.hejitech.workers.dev")!,
        supabaseURL: URL(string: "https://jitdzllkxfhlrxxvljhp.supabase.co")!,
        anonKey: "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
    )

    /// `npm run dev:worker -w @fitloop/web` and `supabase start` on this Mac (the simulator reaches 127.0.0.1).
    public static let local = BackendConfig(
        site: URL(string: "http://127.0.0.1:8794")!,
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
}

public enum BackendError: Error, LocalizedError, Equatable {
    case http(Int, String)
    case notSignedIn
    case decode(String)

    public var errorDescription: String? {
        switch self {
        case .http(_, let body):
            if let data = body.data(using: .utf8), let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let e = obj["error"] as? String { return e }
            return "Server error: \(body.prefix(160))"
        case .notSignedIn: return "Not signed in"
        case .decode(let s): return "Unexpected server response: \(s)"
        }
    }

    public var isUnauthorized: Bool { if case .http(401, _) = self { return true } else { return false } }
}

/// Supabase Auth (Google through the browser with PKCE, Apple with an identity token, refresh) and
/// the Worker's API with the session's access token. No SDK.
public final class Backend: @unchecked Sendable {
    public let config: BackendConfig
    private let http: URLSession
    private let lock = NSLock()
    private var _session: AuthSession?
    /// Persist the session (the app stores it in the Keychain).
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

    // MARK: auth

    /// Browser sign-in (Google) with PKCE: open `url` in a web authentication session that returns to
    /// `redirect`, then hand the callback's `code` and this `verifier` to `exchangeCode`.
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

    /// Sign in with Apple's identity token.
    @discardableResult
    public func signIn(provider: String, idToken: String, nonce: String? = nil) async throws -> AuthSession {
        var body = ["provider": provider, "id_token": idToken]
        if let nonce { body["nonce"] = nonce }
        return try await authRequest("token?grant_type=id_token", body: body)
    }

    /// Email and password: the local seed account only (Debug builds).
    @discardableResult
    public func signIn(email: String, password: String) async throws -> AuthSession {
        try await authRequest("token?grant_type=password", body: ["email": email, "password": password])
    }

    /// Email and password for accounts FitLoop hands out (App Review's demo account): checked by the
    /// Worker (`/api/review-sign-in`), which returns a normal Supabase session. Not a sign-up.
    @discardableResult
    public func reviewSignIn(email: String, password: String) async throws -> AuthSession {
        var req = URLRequest(url: config.site.appendingPathComponent("api/review-sign-in"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        return try adopt(data)
    }

    public func signOut() { setSession(nil) }

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
        return try adopt(data)
    }

    /// Keeps the session from a Supabase token response (`access_token`, `refresh_token`, `user`, …).
    private func adopt(_ data: Data) throws -> AuthSession {
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = obj["access_token"] as? String, let refresh = obj["refresh_token"] as? String,
              let user = obj["user"] as? [String: Any], let id = user["id"] as? String else {
            throw BackendError.decode(String(decoding: data.prefix(200), as: UTF8.self))
        }
        let expires = (obj["expires_in"] as? Double) ?? 3600
        let s = AuthSession(accessToken: access, refreshToken: refresh, userId: id, email: user["email"] as? String, expiresAt: Date().addingTimeInterval(expires))
        setSession(s)
        return s
    }

    static func check(_ resp: URLResponse, _ data: Data) throws {
        let code = (resp as? HTTPURLResponse)?.statusCode ?? -1
        guard (200..<300).contains(code) else { throw BackendError.http(code, String(decoding: data, as: UTF8.self)) }
    }

    static func randomURLSafe(bytes: Int) -> String {
        var rng = SystemRandomNumberGenerator()
        return Data((0..<bytes).map { _ in UInt8.random(in: .min ... .max, using: &rng) }).base64URL
    }

    // MARK: Worker API

    public static let decoder = JSONDecoder()
    public static let encoder = JSONEncoder()

    /// Calls the Worker with the session; `auth: false` for public endpoints.
    public func call<T: Decodable>(_ method: String, _ path: String, body: (some Encodable)? = Optional<Int>.none, auth: Bool = true, as: T.Type = T.self) async throws -> T {
        var req = URLRequest(url: URL(string: config.site.absoluteString + path)!)
        req.httpMethod = method
        req.timeoutInterval = 15
        req.setValue("phone", forHTTPHeaderField: "X-FitLoop-Client")
        if auth {
            try await refreshIfNeeded()
            guard let s = session else { throw BackendError.notSignedIn }
            req.setValue("Bearer \(s.accessToken)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try Self.encoder.encode(body)
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
    public struct Created: Decodable, Sendable { public var id: String }

    public func today(_ date: String) async throws -> TodayResponse { try await call("GET", "/api/today?date=\(date)") }
    public func plan() async throws -> PlanResponse { try await call("GET", "/api/plan") }
    public func checkin(_ c: [NewCheckin]) async throws { let _: OK = try await call("POST", "/api/checkins", body: c) }
    public func feedback() async throws -> [Feedback] { try await call("GET", "/api/feedback") }
    public func sendFeedback(_ f: NewFeedback) async throws { let _: Created = try await call("POST", "/api/feedback", body: f) }
    public func deleteFeedback(_ id: String) async throws { let _: OK = try await call("DELETE", "/api/feedback/\(id)") }
    public func progress(from: String, to: String) async throws -> ProgressResponse { try await call("GET", "/api/progress?from=\(from)&to=\(to)") }
    public func settings() async throws -> SettingsResponse { try await call("GET", "/api/settings") }
    public func save(_ settings: Settings) async throws -> SettingsResponse {
        struct Body: Encodable { let settings: Settings }
        return try await call("PUT", "/api/settings", body: Body(settings: settings))
    }
    public func sendVitals(_ v: [Vital]) async throws { let _: OK = try await call("POST", "/api/vitals", body: v) }
    /// The Watch's heart rate, relayed for the glasses (nil clears it at the end of a workout).
    public func live(hr: Int?, workoutRef: String?) async throws {
        struct Body: Encodable { let hr: Int?; let workout_ref: String? }
        let _: OK = try await call("PUT", "/api/live", body: Body(hr: hr, workout_ref: workoutRef))
    }
    public func photos() async throws -> [Photo] { try await call("GET", "/api/photos") }
    public func deletePhoto(_ id: String) async throws { let _: OK = try await call("DELETE", "/api/photos/\(id)") }
    /// Uploads a JPEG progress photo.
    public func uploadPhoto(_ jpeg: Data, takenOn: String) async throws {
        try await refreshIfNeeded()
        guard let s = session else { throw BackendError.notSignedIn }
        var req = URLRequest(url: URL(string: "\(config.site.absoluteString)/api/photos?taken_on=\(takenOn)")!)
        req.httpMethod = "POST"
        req.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(s.accessToken)", forHTTPHeaderField: "Authorization")
        req.httpBody = jpeg
        let (data, resp) = try await URLSession.shared.data(for: req)
        try Self.check(resp, data)
    }
    public func pairingCode() async throws -> PairingCode { try await call("POST", "/api/pairing-code") }
    public func devices() async throws -> [PairedDevice] { try await call("GET", "/api/devices") }
    public func unpair(_ id: String) async throws { let _: OK = try await call("DELETE", "/api/devices/\(id)") }
    public func deleteData() async throws { let _: OK = try await call("DELETE", "/api/account") }
}

extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
