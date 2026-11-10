import Foundation

public enum APIError: LocalizedError, Sendable, Equatable {
    case invalidURL
    case networkError(String)
    case serverError(statusCode: Int, message: String)
    case decodingError(String)
    case unauthenticated

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL."
        case .networkError(let msg):
            return "Network connection issue: \(msg)"
        case .serverError(_, let msg):
            return msg
        case .decodingError(let msg):
            return "Couldn't read the server's reply: \(msg)"
        case .unauthenticated:
            return "Signed out: sign in again, or pair this iPhone again."
        }
    }

    public var isNotFound: Bool { if case .serverError(404, _) = self { return true } else { return false } }
}

/// A 6-digit code for pairing glasses (or another phone), as the web app's Pair page makes it.
public struct PairingCode: Codable, Hashable, Sendable {
    public let code: String
    public let expiresAt: String

    public enum CodingKeys: String, CodingKey {
        case code
        case expiresAt = "expires_at"
    }
}

/// A paired pair of glasses, phone or podcast feed (`/api/devices`).
public struct PairedDevice: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let kind: String
    public let label: String?
    public let createdAt: String
    public let lastUsedAt: String?

    public enum CodingKeys: String, CodingKey {
        case id, kind, label
        case createdAt = "created_at"
        case lastUsedAt = "last_used_at"
    }
}

/// The G2 Digest Worker. A signed-in session (the same as the web app's) can do what the web app
/// does; a device token from a pairing code only reads editions.
public actor G2DigestAPI {
    public static let defaultBaseURL = URL(string: "https://g2digest.hejitech.workers.dev")!
    public typealias AccessTokenProvider = @Sendable () async throws -> String?

    private let baseURL: URL
    private var token: String?
    private var sessionToken: AccessTokenProvider?
    private let session: URLSession
    /// The `issues` of the last refused request (a brief save).
    private var lastIssues: [BriefIssue] = []

    public init(baseURL: URL = defaultBaseURL, token: String? = nil, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.token = token
        self.session = session
    }

    public func setToken(_ newToken: String?) {
        self.token = newToken
    }

    public func getToken() -> String? {
        return self.token
    }

    /// The signed-in session's access token; it takes precedence over a device token.
    public func setAccessTokenProvider(_ provider: AccessTokenProvider?) {
        self.sessionToken = provider
    }

    private func makeRequest(path: String, method: String = "GET", body: Data? = nil) async throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 20
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let bearer = try await sessionToken?() ?? token
        if let bearer, !bearer.isEmpty {
            req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = body
        return req
    }

    /// Sends a request and checks the status; the Worker's `{"error": …}` becomes the message.
    private func send(_ path: String, method: String = "GET", json: [String: Any]? = nil) async throws -> Data {
        let body = try json.map { try JSONSerialization.data(withJSONObject: $0) }
        let req = try await makeRequest(path: path, method: method, body: body)
        let data: Data, response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.networkError(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid HTTP response")
        }
        if http.statusCode == 401 { throw APIError.unauthenticated }
        guard (200..<300).contains(http.statusCode) else {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            lastIssues = (obj?["issues"]).flatMap { try? JSONSerialization.data(withJSONObject: $0) }
                .flatMap { try? JSONDecoder().decode([BriefIssue].self, from: $0) } ?? []
            let msg = obj?["error"] as? String
            throw APIError.serverError(statusCode: http.statusCode, message: msg ?? "Request failed (\(http.statusCode))")
        }
        return data
    }

    private func decode<T: Decodable>(_ type: T.Type, _ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(String(describing: error).prefix(240).description)
        }
    }

    public func redeemPairingCode(code: String, label: String = "iPhone App") async throws -> PairResult {
        let cleanCode = code.filter { $0.isNumber }
        let data = try await send("/api/pair", method: "POST", json: ["code": cleanCode, "label": label])
        let result = try decode(PairResult.self, data)
        self.token = result.deviceToken
        return result
    }

    public func fetchDeviceStatus() async throws -> DeviceStatus {
        try decode(DeviceStatus.self, try await send("/api/device"))
    }

    public func fetchEditions() async throws -> [EditionSummary] {
        try decode([EditionSummary].self, try await send("/api/editions"))
    }

    public func fetchEdition(date: String = "latest") async throws -> EditionResponse {
        try decode(EditionResponse.self, try await send("/api/editions/\(date)"))
    }

    /// The brief and its version (`{ brief, brief_version }`, as the web app reads it).
    public func fetchBrief() async throws -> BriefResponse {
        try decode(BriefResponse.self, try await send("/api/brief"))
    }

    /// Saves the brief. A brief with problems comes back as `BriefSaveError.issues`; someone else's
    /// newer save (the web app) as `.conflict`.
    public func saveBrief(_ brief: Brief, expectedVersion: Int) async throws -> BriefSaveResult {
        let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(brief))
        do {
            return try decode(BriefSaveResult.self, try await send("/api/brief", method: "PUT", json: ["brief": body, "expected_version": expectedVersion]))
        } catch APIError.serverError(422, let msg) {
            throw BriefSaveError.issues(msg, lastIssues)
        } catch APIError.serverError(409, let msg) {
            throw BriefSaveError.conflict(msg)
        }
    }

    // MARK: signed-in only (the web app's Pair page and account)

    public func createPairingCode() async throws -> PairingCode {
        try decode(PairingCode.self, try await send("/api/pairing-code", method: "POST"))
    }

    public func fetchDevices() async throws -> [PairedDevice] {
        try decode([PairedDevice].self, try await send("/api/devices"))
    }

    public func revokeDevice(id: String) async throws {
        _ = try await send("/api/devices/\(id)", method: "DELETE")
    }

    /// A private podcast feed of every card's audio. The URL is shown once.
    public func createFeed() async throws -> String {
        let obj = try JSONSerialization.jsonObject(with: try await send("/api/feeds", method: "POST")) as? [String: Any]
        guard let url = obj?["url"] as? String else { throw APIError.decodingError("no feed url") }
        return url
    }

    public func fetchTokens() async throws -> [AgentToken] {
        try decode([AgentToken].self, try await send("/api/tokens"))
    }

    /// A new agent token for the build agent's MCP connection. The token is shown once.
    public func createToken(name: String) async throws -> String {
        let obj = try JSONSerialization.jsonObject(with: try await send("/api/tokens", method: "POST", json: ["name": name])) as? [String: Any]
        guard let token = obj?["token"] as? String else { throw APIError.decodingError("no token") }
        return token
    }

    public func revokeToken(id: String) async throws {
        _ = try await send("/api/tokens/\(id)", method: "DELETE")
    }

    /// Assistants connected over OAuth (MCP).
    public func fetchGrants() async throws -> [ConnectedAssistant] {
        try decode([ConnectedAssistant].self, try await send("/api/grants"))
    }

    public func revokeGrant(id: String) async throws {
        let enc = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? id
        _ = try await send("/api/grants/\(enc)", method: "DELETE")
    }

    /// Registers this iPhone for a notification when a new edition is published.
    public func registerPush(token: String, sandbox: Bool) async throws {
        _ = try await send("/api/push", method: "POST", json: ["token": token, "sandbox": sandbox])
    }

    public func unregisterPush(token: String) async throws {
        _ = try await send("/api/push/\(token)", method: "DELETE")
    }

    /// Deletes everything G2 Digest holds for the account (brief, editions, audio, devices, feeds,
    /// tokens, connected assistants), as Delete all my G2 Digest data on the web does.
    public func deleteAllData() async throws {
        _ = try await send("/api/account", method: "DELETE")
    }
}

public enum BriefSaveError: LocalizedError, Equatable, Sendable {
    case issues(String, [BriefIssue])
    case conflict(String)

    public var errorDescription: String? {
        switch self {
        case .issues(let m, let issues): issues.isEmpty ? m : issues.map(\.message).joined(separator: "\n")
        case .conflict(let m): m
        }
    }
}

/// An agent token (`g2a_…`) for the build agent's MCP connection; the token itself is never listed.
public struct AgentToken: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let createdAt: String
    public let lastUsedAt: String?

    public enum CodingKeys: String, CodingKey {
        case id, name
        case createdAt = "created_at"
        case lastUsedAt = "last_used_at"
    }
}

/// An assistant connected over OAuth.
public struct ConnectedAssistant: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let clientName: String?
    public let createdAt: String

    public enum CodingKeys: String, CodingKey {
        case id
        case clientName = "client_name"
        case createdAt = "created_at"
    }
}
