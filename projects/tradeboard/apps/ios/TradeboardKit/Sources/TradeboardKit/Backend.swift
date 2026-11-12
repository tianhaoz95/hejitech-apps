import CryptoKit
import Foundation
import Security

public struct SavedSession: Codable, Equatable, Sendable {
    public var cookie: String
    public var email: String?

    public init(cookie: String, email: String? = nil) {
        self.cookie = cookie
        self.email = email
    }
}

/// Persists the verified portal session cookie in the iOS Keychain (`kSecAttrAccessibleAfterFirstUnlock`),
/// scoped per backend host so local development and production sessions stay independent.
public enum SessionStore {
    private static let service = "com.hejitech.tradeboard"
    private static let installFlagKey = "tradeboard.installed"

    public static func accountKey(for config: BackendConfig) -> String {
        "session.\(config.site.host ?? "default")"
    }

    /// The iOS Keychain survives app deletion; clear any leftover session on the first launch of a fresh install.
    public static func clearIfFreshInstall(defaults: UserDefaults = .standard) {
        if !defaults.bool(forKey: installFlagKey) {
            clearAll()
            defaults.set(true, forKey: installFlagKey)
        }
    }

    public static func load(for config: BackendConfig) -> SavedSession? {
        let account = accountKey(for: config)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else {
            return nil
        }
        if let saved = try? JSONDecoder().decode(SavedSession.self, from: data), !saved.cookie.isEmpty {
            return saved
        }
        if let rawCookie = String(data: data, encoding: .utf8), !rawCookie.isEmpty {
            return SavedSession(cookie: rawCookie)
        }
        return nil
    }

    public static func save(_ session: SavedSession?, for config: BackendConfig) {
        let account = accountKey(for: config)
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        guard let session, !session.cookie.isEmpty,
              let data = try? JSONEncoder().encode(session) else {
            return
        }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    public static func clear(for config: BackendConfig) {
        save(nil, for: config)
    }

    public static func clearAll() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

public struct BackendConfig: Hashable, Sendable {
    public var site: URL
    public var supabaseURL: URL
    public var anonKey: String

    public init(site: URL, supabaseURL: URL, anonKey: String) {
        self.site = site
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
    }

    /// Production Tradeboard Worker and the shared HEJI Supabase backend.
    public static let production = BackendConfig(
        site: URL(string: "https://tradeboard.hejitech.workers.dev")!,
        supabaseURL: URL(string: "https://jitdzllkxfhlrxxvljhp.supabase.co")!,
        anonKey: "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
    )

    /// Local development stack on Mac (Worker on 8798, Supabase on 55421).
    public static let local = BackendConfig(
        site: URL(string: "http://127.0.0.1:8798")!,
        supabaseURL: URL(string: "http://127.0.0.1:55421")!,
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )
}

public enum BackendError: Error, LocalizedError, Equatable {
    case http(Int, String)
    case notSignedIn
    case invalidResponse(String)
    case totpRequired(enroll: Bool, secret: String?, otpauth: String?)

    public var errorDescription: String? {
        switch self {
        case .http(let status, let body):
            if let data = body.data(using: .utf8),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let msg = obj["message"] as? String ?? obj["error"] as? String {
                return msg
            }
            return "Server error (\(status)): \(body.prefix(160))"
        case .notSignedIn:
            return "Not signed in"
        case .invalidResponse(let msg):
            return "Unexpected response: \(msg)"
        case .totpRequired(let enroll, _, _):
            return enroll ? "Authenticator setup required" : "Two-factor verification required"
        }
    }

    public var isUnauthorized: Bool {
        if case .http(401, _) = self { return true }
        if case .notSignedIn = self { return true }
        return false
    }
}

public struct SupabaseSession: Codable, Hashable, Sendable {
    public var accessToken: String
    public var refreshToken: String
    public var userId: String
    public var email: String?
    public var expiresAt: Date
}

public struct AuthBeginResult: Codable, Hashable, Sendable {
    public var enroll: Bool
    public var secret: String?
    public var otpauth: String?
}

public final class TradeboardBackend: @unchecked Sendable {
    public let config: BackendConfig
    private let http: URLSession
    private let lock = NSLock()
    private var _sessionCookie: String?
    private var _supabaseSession: SupabaseSession?

    public var onSessionChange: ((String?) -> Void)?

    public init(config: BackendConfig, sessionCookie: String? = nil, http: URLSession = .shared) {
        self.config = config
        self._sessionCookie = sessionCookie
        self.http = http
    }

    public var sessionCookie: String? {
        lock.lock(); defer { lock.unlock() }
        return _sessionCookie
    }

    public func setSessionCookie(_ cookie: String?) {
        lock.lock()
        _sessionCookie = cookie
        lock.unlock()
        onSessionChange?(cookie)
    }

    public var supabaseSession: SupabaseSession? {
        lock.lock(); defer { lock.unlock() }
        return _supabaseSession
    }

    public func setSupabaseSession(_ s: SupabaseSession?) {
        lock.lock()
        _supabaseSession = s
        lock.unlock()
    }

    public var isSignedIn: Bool {
        sessionCookie != nil
    }

    // MARK: - Supabase Auth (Step 1)

    public func signInWithApple(idToken: String, nonce: String? = nil) async throws -> SupabaseSession {
        var body: [String: Any] = ["provider": "apple", "id_token": idToken]
        if let nonce { body["nonce"] = nonce }
        let session = try await supabaseAuthRequest("token?grant_type=id_token", body: body)
        setSupabaseSession(session)
        return session
    }

    public func signInWithEmail(email: String, password: String) async throws -> SupabaseSession {
        let body = ["email": email, "password": password]
        let session = try await supabaseAuthRequest("token?grant_type=password", body: body)
        setSupabaseSession(session)
        return session
    }

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

    public func exchangeCode(_ code: String, verifier: String) async throws -> SupabaseSession {
        let session = try await supabaseAuthRequest("token?grant_type=pkce", body: ["auth_code": code, "code_verifier": verifier])
        setSupabaseSession(session)
        return session
    }

    // MARK: - Tradeboard Worker TOTP Auth (Step 2)

    public func authBegin(supabaseAccessToken: String) async throws -> AuthBeginResult {
        var req = URLRequest(url: config.site.appendingPathComponent("api/auth/begin"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("1", forHTTPHeaderField: "X-Tradeboard")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["access_token": supabaseAccessToken])

        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        return try JSONDecoder().decode(AuthBeginResult.self, from: data)
    }

    public func authVerify(supabaseAccessToken: String, code: String) async throws {
        var req = URLRequest(url: config.site.appendingPathComponent("api/auth/verify"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("1", forHTTPHeaderField: "X-Tradeboard")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["access_token": supabaseAccessToken, "code": code])

        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)

        // Capture session cookie from Set-Cookie header
        guard let httpResp = resp as? HTTPURLResponse else {
            throw BackendError.invalidResponse("Not an HTTP response")
        }

        let cookieValue = Self.extractSessionCookie(from: httpResp)
        if let cookieValue {
            setSessionCookie(cookieValue)
        } else {
            // Some environments may set cookie via storage
            setSessionCookie("active")
        }
    }

    /// Email sign-in for accounts Tradeboard hands out (App Review's demo account): the Worker checks
    /// them against its own secrets and sets the same session cookie as the TOTP step.
    public func reviewSignIn(email: String, password: String) async throws {
        var req = URLRequest(url: config.site.appendingPathComponent("api/review-sign-in"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("1", forHTTPHeaderField: "X-Tradeboard")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])

        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        guard let httpResp = resp as? HTTPURLResponse, let cookieValue = Self.extractSessionCookie(from: httpResp) else {
            throw BackendError.invalidResponse("No session in the sign-in response")
        }
        setSessionCookie(cookieValue)
    }

    /// Deletes this board for good: plans, history, policy, strategy, agents and their tokens, executor
    /// credentials and sessions (the same as Account → Delete my board on the web). The sign-in itself
    /// is shared with other HEJI apps and stays.
    public func deleteAccount() async throws {
        guard let cookie = sessionCookie else { throw BackendError.notSignedIn }
        var c = URLComponents(url: config.site.appendingPathComponent("api/account"), resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "confirm", value: "1")]
        var req = URLRequest(url: c.url!)
        req.httpMethod = "DELETE"
        req.setValue("1", forHTTPHeaderField: "X-Tradeboard")
        req.setValue(cookieHeader(for: cookie), forHTTPHeaderField: "Cookie")
        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        setSessionCookie(nil)
        setSupabaseSession(nil)
    }

    public func logout() async {
        if let cookie = sessionCookie {
            var req = URLRequest(url: config.site.appendingPathComponent("api/auth/logout"))
            req.httpMethod = "POST"
            req.setValue("1", forHTTPHeaderField: "X-Tradeboard")
            req.setValue(cookieHeader(for: cookie), forHTTPHeaderField: "Cookie")
            _ = try? await http.data(for: req)
        }
        setSessionCookie(nil)
        setSupabaseSession(nil)
    }

    // MARK: - Board Portal APIs

    public func getMe() async throws -> MeResponse {
        try await apiGet("api/me")
    }

    public func getBoard(status: String? = nil, ticker: String? = nil) async throws -> BoardSummary {
        var path = "api/board"
        var queryItems: [String] = []
        if let status, !status.isEmpty { queryItems.append("status=\(status)") }
        if let ticker, !ticker.isEmpty { queryItems.append("ticker=\(ticker)") }
        if !queryItems.isEmpty {
            path += "?" + queryItems.joined(separator: "&")
        }
        return try await apiGet(path)
    }

    public func getPlan(id: String) async throws -> PlanDetail {
        try await apiGet("api/plans/\(id)")
    }

    public func createPlan(
        title: String,
        ticker: String,
        side: String = "buy",
        orderType: String = "limit",
        shares: Double? = nil,
        dollars: Double? = nil,
        limitPrice: Double? = nil,
        stopPrice: Double? = nil,
        thesis: String,
        evidence: String = "",
        risks: String = "",
        invalidation: String = "",
        fitWithStrategy: String = "",
        validUntil: String
    ) async throws -> [String: AnyCodable] {
        var order: [String: Any] = [
            "ticker": ticker.uppercased(),
            "side": side,
            "order_type": orderType,
            "time_in_force": "day",
            "account_scope": "dedicated_mcp_account_only",
        ]
        if let shares { order["quantity_shares"] = shares }
        if let dollars { order["quantity_dollars"] = dollars }
        if let limitPrice { order["limit_price"] = limitPrice }
        if let stopPrice { order["stop_price"] = stopPrice }

        let body: [String: Any] = [
            "title": title,
            "ticker": ticker.uppercased(),
            "side": side,
            "order": order,
            "thesis": thesis,
            "evidence": evidence,
            "risks_and_dissent": risks,
            "invalidation": invalidation,
            "fit_with_strategy": fitWithStrategy,
            "valid_until": validUntil,
        ]

        return try await apiPost("api/plans", body: body)
    }

    public func markReady(planId: String) async throws -> [String: AnyCodable] {
        try await apiPost("api/plans/\(planId)/ready", body: [:])
    }

    public func approvePlan(planId: String, version: Int, note: String = "") async throws -> [String: AnyCodable] {
        try await apiPost("api/plans/\(planId)/approve", body: ["version": version, "note": note])
    }

    public func rejectPlan(planId: String, reason: String) async throws -> [String: AnyCodable] {
        try await apiPost("api/plans/\(planId)/reject", body: ["reason": reason])
    }

    public func cancelPlan(planId: String, reason: String = "") async throws -> [String: AnyCodable] {
        try await apiPost("api/plans/\(planId)/cancel", body: ["reason": reason])
    }

    public func requestChanges(planId: String, body: String) async throws -> [String: AnyCodable] {
        try await apiPost("api/plans/\(planId)/request-changes", body: ["body": body])
    }

    public func addComment(planId: String, body: String, isQuestion: Bool = false) async throws -> [String: AnyCodable] {
        try await apiPost("api/plans/\(planId)/comments", body: ["body": body, "is_question": isQuestion])
    }

    public func toggleDryRun(enabled: Bool) async throws -> [String: AnyCodable] {
        try await apiPost("api/control/dry-run", body: ["dry_run": enabled])
    }

    public func pauseBoard(paused: Bool) async throws -> [String: AnyCodable] {
        try await apiPost("api/control/pause", body: ["paused": paused])
    }

    public func killBoard() async throws -> [String: AnyCodable] {
        try await apiPost("api/control/kill", body: [:])
    }

    public func getStrategy() async throws -> StrategyResponse {
        try await apiGet("api/strategy")
    }

    public func updateStrategy(content: String) async throws -> [String: AnyCodable] {
        try await apiRequest("api/strategy", method: "PUT", body: ["content": content])
    }

    public func getExecutors() async throws -> [ExecutorItem] {
        try await apiGet("api/executors")
    }

    // MARK: - HTTP Helpers

    private func cookieHeader(for value: String) -> String {
        let name = config.site.absoluteString.starts(with: "https://") ? "__Host-tb_session" : "tb_session"
        return "\(name)=\(value)"
    }

    private func apiGet<T: Decodable>(_ path: String) async throws -> T {
        try await apiRequest(path, method: "GET", body: nil)
    }

    private func apiPost<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        try await apiRequest(path, method: "POST", body: body)
    }

    private func apiRequest<T: Decodable>(_ path: String, method: String, body: [String: Any]?) async throws -> T {
        guard let cookie = sessionCookie else { throw BackendError.notSignedIn }

        let url = config.site.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(cookieHeader(for: cookie), forHTTPHeaderField: "Cookie")

        if method != "GET" && method != "HEAD" {
            req.setValue("1", forHTTPHeaderField: "X-Tradeboard")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if let body {
                req.httpBody = try JSONSerialization.data(withJSONObject: body)
            }
        }

        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func supabaseAuthRequest(_ path: String, body: [String: Any]) async throws -> SupabaseSession {
        // `path` carries a query ("token?grant_type=pkce"): appendingPathComponent would encode the "?"
        // into the path (…/token%3Fgrant_type=pkce) and Supabase answers 404.
        guard let url = URL(string: "auth/v1/\(path)", relativeTo: config.supabaseURL.hasDirectoryPath ? config.supabaseURL : config.supabaseURL.appendingPathComponent(""))?.absoluteURL else {
            throw BackendError.invalidResponse("bad auth path \(path)")
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(config.anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)

        guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = dict["access_token"] as? String,
              let refresh = dict["refresh_token"] as? String,
              let user = dict["user"] as? [String: Any],
              let id = user["id"] as? String else {
            throw BackendError.invalidResponse(String(data: data, encoding: .utf8) ?? "")
        }

        let email = user["email"] as? String
        let expiresIn = (dict["expires_in"] as? Double) ?? 3600
        return SupabaseSession(
            accessToken: access,
            refreshToken: refresh,
            userId: id,
            email: email,
            expiresAt: Date(timeIntervalSinceNow: expiresIn)
        )
    }

    static func extractSessionCookie(from response: HTTPURLResponse) -> String? {
        let cookieNames: Set<String> = ["__Host-tb_session", "tb_session"]
        if let allHeaderFields = response.allHeaderFields as? [String: String] {
            for (key, val) in allHeaderFields where key.lowercased() == "set-cookie" {
                for part in val.components(separatedBy: ";") {
                    for sub in part.components(separatedBy: ",") {
                        let item = sub.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard let eqIdx = item.firstIndex(of: "=") else { continue }
                        let name = String(item[..<eqIdx]).trimmingCharacters(in: .whitespaces)
                        let value = String(item[item.index(after: eqIdx)...])
                        if cookieNames.contains(name), !value.isEmpty {
                            return value.removingPercentEncoding ?? value
                        }
                    }
                }
            }
        }
        if let url = response.url,
           let cookies = HTTPCookieStorage.shared.cookies(for: url),
           let match = cookies.first(where: { cookieNames.contains($0.name) && !$0.value.isEmpty }) {
            return match.value.removingPercentEncoding ?? match.value
        }
        return nil
    }

    private static func check(_ resp: URLResponse, _ data: Data) throws {
        guard let http = resp as? HTTPURLResponse else { return }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw BackendError.http(http.statusCode, body)
        }
    }

    private static func randomURLSafe(bytes count: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        return Data(bytes).base64URL
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
