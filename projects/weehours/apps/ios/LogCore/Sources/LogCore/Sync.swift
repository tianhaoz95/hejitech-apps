import CryptoKit
import Foundation

public struct BackendConfig: Codable, Hashable, Sendable {
    public var url: URL
    public var anonKey: String

    public init(url: URL, anonKey: String) {
        self.url = url
        self.anonKey = anonKey
    }

    /// Local `supabase start` defaults (the demo anon key every local stack ships with). The stack is
    /// the monorepo's shared one (repo root `supabase/`, ports 554xx).
    public static let local = BackendConfig(
        url: URL(string: "http://127.0.0.1:55421")!,
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )

    /// The hosted Supabase project every HEJI app shares (publishable key: safe to ship).
    public static let production = BackendConfig(
        url: URL(string: "https://jitdzllkxfhlrxxvljhp.supabase.co")!,
        anonKey: "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
    )

    /// Wee Hours' tables live in their own Postgres schema in the shared project; PostgREST picks
    /// it from these headers.
    public static let schema = "weehours"
    /// Its Storage bucket (named after the project, like the schema).
    public static let bucket = "weehours"
}

public struct AuthSession: Codable, Hashable, Sendable {
    public var accessToken: String
    public var refreshToken: String
    public var userId: UUID
    public var email: String?
    public var expiresAt: Date

    enum CodingKeys: String, CodingKey {
        case email
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case userId = "user_id"
        case expiresAt = "expires_at"
    }
}

public enum BackendError: Error, LocalizedError {
    case http(Int, String)
    case notSignedIn
    case decode(String)

    public var errorDescription: String? {
        switch self {
        case .http(let code, let body): return "Server error \(code): \(body.prefix(200))"
        case .notSignedIn: return "Not signed in"
        case .decode(let s): return "Unexpected server response: \(s)"
        }
    }
}

public struct AccessToken: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var name: String
    public var scope: String
    public var createdAt: Date
    public var lastUsedAt: Date?
    public var revokedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, scope
        case createdAt = "created_at"
        case lastUsedAt = "last_used_at"
        case revokedAt = "revoked_at"
    }
}

/// A thin Supabase client (Auth + PostgREST + Storage) over URLSession, with no SDK dependency so
/// the watch, widgets and tests can use it too.
public final class SupabaseClient: @unchecked Sendable {
    public let config: BackendConfig
    public private(set) var session: AuthSession?
    private let http: URLSession
    private let lock = NSLock()
    public var onSessionChange: ((AuthSession?) -> Void)?

    public init(config: BackendConfig, session: AuthSession? = nil, http: URLSession = .shared) {
        self.config = config
        self.session = session
        self.http = http
    }

    // MARK: auth

    public func signUp(email: String, password: String) async throws -> AuthSession {
        try await authRequest("signup", body: ["email": email, "password": password])
    }

    public func signIn(email: String, password: String) async throws -> AuthSession {
        try await authRequest("token?grant_type=password", body: ["email": email, "password": password])
    }

    /// Sign in with an Apple or Google identity token (native SDK flows hand this over).
    public func signIn(provider: String, idToken: String, nonce: String? = nil) async throws -> AuthSession {
        var body = ["provider": provider, "id_token": idToken]
        if let nonce { body["nonce"] = nonce }
        return try await authRequest("token?grant_type=id_token", body: body)
    }

    /// Browser sign-in (Google) with PKCE: open `url` in a web authentication session that returns to
    /// `redirect`, then hand the callback's `code` and this `verifier` to `exchangeCode`.
    public func oauthStart(provider: String, redirect: String) -> (url: URL, verifier: String) {
        let verifier = Self.randomURLSafe(bytes: 48)
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded
        var c = URLComponents(url: config.url.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false)!
        c.queryItems = [
            URLQueryItem(name: "provider", value: provider),
            URLQueryItem(name: "redirect_to", value: redirect),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "s256"),
        ]
        return (c.url!, verifier)
    }

    /// Finishes `oauthStart`: trades the callback's code for a session.
    public func exchangeCode(_ code: String, verifier: String) async throws -> AuthSession {
        try await authRequest("token?grant_type=pkce", body: ["auth_code": code, "code_verifier": verifier])
    }

    static func randomURLSafe(bytes: Int) -> String {
        var rng = SystemRandomNumberGenerator()
        return Data((0..<bytes).map { _ in UInt8.random(in: .min ... .max, using: &rng) }).base64URLEncoded
    }

    public func refreshIfNeeded() async throws {
        guard let s = currentSession() else { throw BackendError.notSignedIn }
        if s.expiresAt.timeIntervalSinceNow > 60 { return }
        _ = try await authRequest("token?grant_type=refresh_token", body: ["refresh_token": s.refreshToken])
    }

    public func signOut() {
        setSession(nil)
    }

    /// The session's access token, refreshed when it's about to expire: for the site Worker's
    /// endpoints that take a Supabase session (glasses pairing codes).
    public func sessionToken() async throws -> String {
        try await refreshIfNeeded()
        guard let s = currentSession() else { throw BackendError.notSignedIn }
        return s.accessToken
    }

    private func currentSession() -> AuthSession? {
        lock.lock(); defer { lock.unlock() }
        return session
    }

    private func setSession(_ s: AuthSession?) {
        lock.lock()
        session = s
        lock.unlock()
        onSessionChange?(s)
    }

    private func authRequest(_ path: String, body: [String: String]) async throws -> AuthSession {
        var req = URLRequest(url: URL(string: "\(config.url.absoluteString)/auth/v1/\(path)")!)
        req.httpMethod = "POST"
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = obj["access_token"] as? String, let refresh = obj["refresh_token"] as? String,
              let user = obj["user"] as? [String: Any], let idStr = user["id"] as? String, let id = UUID(uuidString: idStr) else {
            throw BackendError.decode(String(decoding: data.prefix(200), as: UTF8.self))
        }
        let expires = (obj["expires_in"] as? Double) ?? 3600
        let s = AuthSession(accessToken: access, refreshToken: refresh, userId: id, email: user["email"] as? String,
                            expiresAt: Date().addingTimeInterval(expires))
        setSession(s)
        return s
    }

    static func check(_ resp: URLResponse, _ data: Data) throws {
        let code = (resp as? HTTPURLResponse)?.statusCode ?? -1
        guard (200..<300).contains(code) else { throw BackendError.http(code, String(decoding: data, as: UTF8.self)) }
    }

    // MARK: REST

    public func request(_ method: String, _ path: String, json: Data? = nil, prefer: String? = nil,
                        contentType: String = "application/json", headers: [String: String] = [:]) async throws -> Data {
        try await refreshIfNeeded()
        guard let s = currentSession() else { throw BackendError.notSignedIn }
        var req = URLRequest(url: URL(string: "\(config.url.absoluteString)\(path)")!)
        req.httpMethod = method
        req.timeoutInterval = 15
        req.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(s.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        if path.hasPrefix("/rest/") {
            req.setValue(BackendConfig.schema, forHTTPHeaderField: "Accept-Profile")
            req.setValue(BackendConfig.schema, forHTTPHeaderField: "Content-Profile")
        }
        if let prefer { req.setValue(prefer, forHTTPHeaderField: "Prefer") }
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        if json != nil, contentType.hasPrefix("image/") { req.timeoutInterval = 60 }
        req.httpBody = json
        let (data, resp) = try await http.data(for: req)
        try Self.check(resp, data)
        return data
    }

    public func rpc(_ fn: String, _ args: [String: Any] = [:]) async throws -> Data {
        try await request("POST", "/rest/v1/rpc/\(fn)", json: JSONSerialization.data(withJSONObject: args))
    }

    // MARK: events

    struct RemoteRow: Decodable {
        let seq: Int64
    }

    public func pushEvents(_ events: [LogEvent]) async throws {
        for body in try Self.sameShapeBatches(events) {
            _ = try await request("POST", "/rest/v1/events?on_conflict=id", json: body, prefer: "resolution=ignore-duplicates,return=minimal")
        }
    }

    /// PostgREST rejects a bulk insert whose rows don't all have the same keys (PGRST102, "All
    /// object keys must match"), and the encoder leaves nil optionals out (an undo has
    /// `supersedes`, a tap entry doesn't), so a mixed outbox went nowhere. Rows go up in runs of
    /// one shape, in order, so an entry still lands before the edit or undo that points at it.
    static func sameShapeBatches<T: Encodable>(_ items: [T]) throws -> [Data] {
        var runs: [(keys: [String], rows: [Any])] = []
        for item in items {
            let row = try JSONSerialization.jsonObject(with: LogCoding.encoder.encode(item))
            let keys = (row as? [String: Any]).map { $0.keys.sorted() } ?? []
            if runs.last?.keys == keys { runs[runs.count - 1].rows.append(row) } else { runs.append((keys, [row])) }
        }
        return try runs.map { try JSONSerialization.data(withJSONObject: $0.rows) }
    }

    /// Events after `seq`, ordered. Returns the events and the highest sequence seen.
    public func pullEvents(household: UUID, after seq: Int64, limit: Int = 500) async throws -> ([LogEvent], Int64) {
        let data = try await request("GET", "/rest/v1/events?household_id=eq.\(household.uuidString.lowercased())&seq=gt.\(seq)&order=seq.asc&limit=\(limit)")
        let events = try LogCoding.decoder.decode([LogEvent].self, from: data)
        let seqs = try JSONDecoder().decode([RemoteRow].self, from: data)
        return (events, seqs.map(\.seq).max() ?? seq)
    }

    // MARK: captures

    public func pushCaptures(_ captures: [Capture]) async throws {
        for body in try Self.sameShapeBatches(captures) {
            _ = try await request("POST", "/rest/v1/captures?on_conflict=id", json: body, prefer: "resolution=merge-duplicates,return=minimal")
        }
    }

    public func openCaptures(household: UUID) async throws -> [Capture] {
        let data = try await request("GET", "/rest/v1/captures?household_id=eq.\(household.uuidString.lowercased())&status=in.(pending,needs_review)&order=captured_at.asc")
        return try LogCoding.decoder.decode([Capture].self, from: data)
    }

    public func downloadAudio(path: String) async throws -> Data {
        try await request("GET", "/storage/v1/object/\(BackendConfig.bucket)/\(path)")
    }

    public func deleteAudio(path: String) async throws {
        _ = try await request("DELETE", "/storage/v1/object/\(BackendConfig.bucket)/\(path)")
    }

    public func uploadAudio(path: String, data: Data, contentType: String = "audio/wav") async throws {
        _ = try await request("POST", "/storage/v1/object/\(BackendConfig.bucket)/\(path)", json: data, contentType: contentType)
    }

    // MARK: photos

    /// Uploads (or replaces, so a retry is harmless) a photo under the household's folder.
    public func uploadPhoto(key: String, data: Data) async throws {
        _ = try await request("POST", "/storage/v1/object/\(BackendConfig.bucket)/\(key)", json: data, contentType: "image/jpeg", headers: ["x-upsert": "true"])
    }

    public func downloadPhoto(key: String) async throws -> Data {
        try await request("GET", "/storage/v1/object/\(BackendConfig.bucket)/\(key)")
    }

    public func deletePhoto(key: String) async throws {
        _ = try await request("DELETE", "/storage/v1/object/\(BackendConfig.bucket)/\(key)")
    }

    // MARK: household

    public func createHousehold(_ h: Household, displayName: String) async throws {
        _ = try await rpc("create_household", ["p_id": h.id.uuidString, "p_name": h.name, "p_baby_id": h.babyId.uuidString,
                                               "p_baby_name": h.babyName, "p_birth_date": h.birthDate.map(Self.day) ?? NSNull(),
                                               "p_settings": try settingsJSON(h), "p_display_name": displayName])
        if h.babies.count > 1 { try await saveBabies(h) }
    }

    public func saveSettings(_ h: Household) async throws {
        _ = try await rpc("update_household", ["p_id": h.id.uuidString, "p_name": h.name, "p_baby_name": h.babyName,
                                               "p_birth_date": h.birthDate.map(Self.day) ?? NSNull(), "p_settings": try settingsJSON(h)])
        try await saveBabies(h)
    }

    /// Adds and updates the household's children (`save_babies`); none are ever deleted.
    public func saveBabies(_ h: Household) async throws {
        let rows: [[String: Any]] = h.babies.map { b in
            var row: [String: Any] = ["id": b.id.uuidString, "name": b.name, "birth_date": b.birthDate.map(Self.day) ?? NSNull(),
                                      "position": b.position, "archived": b.archived]
            if let c = b.color { row["color"] = c }
            if let ml = b.bottleMl { row["bottle_ml"] = ml }
            if let f = b.defaultFeed { row["default_feed"] = f }
            if let due = b.dueDate { row["due_date"] = Self.day(due) }
            return row
        }
        _ = try await rpc("save_babies", ["p_babies": rows])
    }

    public func myHousehold() async throws -> Household? {
        let data = try await rpc("my_household")
        guard let obj = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) as? [String: Any] else { return nil }
        return try LogCoding.decoder.decode(Household.self, from: JSONSerialization.data(withJSONObject: obj))
    }

    public func createInvite() async throws -> String {
        let data = try await rpc("create_invite")
        guard let code = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) as? String else {
            throw BackendError.decode("invite")
        }
        return code
    }

    public func joinHousehold(code: String, displayName: String) async throws {
        _ = try await rpc("join_household", ["p_code": code, "p_display_name": displayName])
    }

    public func deleteHouseholdData() async throws {
        // Storage only deletes through its API, so the audio goes first, then the rows (cascading).
        let idData = try await rpc("my_household_id")
        if let household = try JSONSerialization.jsonObject(with: idData, options: .fragmentsAllowed) as? String {
            // capture audio at the top of the folder, photos under photos/ (listings are one level, 1000 at a time)
            for folder in [household, "\(household)/photos"] {
                while true {
                    let listing = try await request("POST", "/storage/v1/object/list/\(BackendConfig.bucket)",
                                                    json: JSONSerialization.data(withJSONObject: ["prefix": folder, "limit": 1000]))
                    // files have an id; sub-folders (photos/) don't
                    let names = ((try JSONSerialization.jsonObject(with: listing)) as? [[String: Any]] ?? [])
                        .filter { !($0["id"] is NSNull) && $0["id"] != nil }.compactMap { $0["name"] as? String }
                    if names.isEmpty { break }
                    _ = try await request("DELETE", "/storage/v1/object/\(BackendConfig.bucket)",
                                          json: JSONSerialization.data(withJSONObject: ["prefixes": names.map { "\(folder)/\($0)" }]))
                    if names.count < 1000 { break }
                }
            }
        }
        _ = try await rpc("delete_household")
    }

    // MARK: entitlements and tokens

    public func fetchEntitlement() async throws -> Entitlement? {
        let data = try await rpc("my_entitlement")
        if String(decoding: data, as: UTF8.self) == "null" { return nil }
        return try LogCoding.decoder.decode(Entitlement.self, from: data)
    }

    /// Dummy billing: the client reports the purchase. Production verifies the App Store signed
    /// transaction server-side before writing the entitlement.
    public func recordPurchase(plan: Plan, expiresAt: Date?) async throws {
        _ = try await rpc("record_purchase", ["p_plan": plan.rawValue, "p_expires_at": expiresAt.map(LogCoding.isoString) ?? NSNull()])
    }

    public func createAccessToken(name: String, scope: String) async throws -> String {
        let data = try await rpc("create_access_token", ["p_name": name, "p_scope": scope])
        guard let token = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) as? String else {
            throw BackendError.decode("token")
        }
        return token
    }

    public func accessTokens() async throws -> [AccessToken] {
        let data = try await request("GET", "/rest/v1/access_tokens?select=id,name,scope,created_at,last_used_at,revoked_at&order=created_at.desc")
        return try LogCoding.decoder.decode([AccessToken].self, from: data)
    }

    public func revokeAccessToken(_ id: UUID) async throws {
        _ = try await rpc("revoke_access_token", ["p_id": id.uuidString])
    }

    /// Removes a revoked token from the list (the server refuses a live one).
    public func deleteAccessToken(_ id: UUID) async throws {
        _ = try await rpc("delete_access_token", ["p_id": id.uuidString])
    }

    /// Your name as the household sees it (`members.display_name`, which `my_household` reports).
    public func setDisplayName(_ name: String) async throws {
        _ = try await rpc("set_display_name", ["p_name": name])
    }

    /// The household-wide settings; children live in their own rows.
    private func settingsJSON(_ h: Household) throws -> Any {
        var obj = try JSONSerialization.jsonObject(with: LogCoding.encoder.encode(h)) as? [String: Any] ?? [:]
        for k in ["babies", "baby_id", "baby_name", "birth_date"] { obj[k] = nil }
        return obj
    }

    static func day(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }
}

extension Data {
    var base64URLEncoded: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
