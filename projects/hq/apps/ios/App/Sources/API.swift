// HQ's API as the iPhone app uses it (the owner's side of projects/hq/services/web/src/worker/api.ts).
// Models mirror @hq/core's card schema (projects/hq/packages/core/src/card.ts).
import Foundation
import Security

struct Evidence: Codable, Hashable {
    var type: String
    var ref: String?
    var text: String?
    var name: String?
    var value: Double?
    var unit: String?
    var source: String?
}

struct CardSource: Codable, Hashable {
    var scout: String?
    var agent: String?
    var session: String?
}

struct Card: Codable, Identifiable, Hashable {
    var id: String
    var project: String
    var kind: String
    var title: String
    var why: String
    var plan: String
    var verify: String
    var tier: String
    var effort: String
    var risk: String
    var risk_reason: String?
    var status: String
    var priority: Int
    var evidence: [Evidence]
    var verbs: [String]
    var source: CardSource
    var branch: String?
    var pr_url: String?
    var created_at: String
}

struct Inbox: Codable {
    var cap: Int
    var decide: [Card]
    var backlog: [Card]
    var discussing: [Card]
    var ready: [Card]
    var working: [Card]
    var reject_reasons: [String]
}

struct Digest: Codable {
    var shipped: Int
    var proposed: Int
    var failed: Int
    var runs_failed: Int
    var needs_you: Int
    var spent_this_week_usd: Double
    var paused: Bool
}

struct Comment: Codable, Identifiable, Hashable {
    var id: Int
    var author: String
    var body: String
    var created_at: String
}

struct DecisionRow: Codable, Hashable {
    var decision: String
    var reason: String?
    var by: String
    var at: String
}

struct Attachment: Codable, Identifiable, Hashable {
    var id: Int
    var phase: String
    var evidence: Evidence
    var file_key: String?
    var by: String
    var at: String
}

struct RunRow: Codable, Identifiable, Hashable {
    var id: String
    var kind: String
    var status: String
    var project: String?
    var scout: String?
    var verb: String?
    var card_id: String?
    var summary: String?
    var cost_usd: Double?
    var created_at: String
}

struct CardDetail: Codable {
    var card: Card
    var comments: [Comment]
    var decisions: [DecisionRow]
    var attachments: [Attachment]
    var runs: [RunRow]
}

struct HealthData: Codable, Hashable {
    var ok: Bool
    var at: String
    var data: [String: JSONValue]
}

struct ProjectHealth: Codable, Identifiable, Hashable {
    var project: String
    var tier_ceiling: String?
    var health: HealthData?
    var open_cards: Int
    var id: String { project }
}

struct HealthBoard: Codable {
    var projects: [ProjectHealth]
    var spent_this_week_usd: Double
    var weekly_budget_usd: Double?
    var paused: Bool
}

/// Any JSON value, for health data whose keys vary by project.
enum JSONValue: Codable, Hashable, CustomStringConvertible {
    case string(String), number(Double), bool(Bool), null, other(String)
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else { self = .other("…") }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .number(let n): try c.encode(n)
        case .bool(let b): try c.encode(b)
        case .null, .other: try c.encodeNil()
        }
    }
    var description: String {
        switch self {
        case .string(let s): return s
        case .number(let n): return n.rounded() == n ? String(Int(n)) : String(n)
        case .bool(let b): return b ? "yes" : "no"
        case .null: return "—"
        case .other(let s): return s
        }
    }
}

struct APIError: LocalizedError {
    var status: Int
    var message: String
    var errorDescription: String? { message }
}

/// The owner's connection: server URL in UserDefaults, token in the Keychain.
enum Connection {
    private static let urlKey = "hq.server-url"
    private static let service = "com.hejitech.hq"

    static var serverURL: String {
        get { UserDefaults.standard.string(forKey: urlKey) ?? "" }
        set { UserDefaults.standard.set(newValue.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "/")), forKey: urlKey) }
    }

    static var token: String {
        get {
            let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "owner", kSecReturnData as String: true]
            var out: AnyObject?
            guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return "" }
            return String(decoding: d, as: UTF8.self)
        }
        set {
            let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "owner"]
            SecItemDelete(base as CFDictionary)
            guard !newValue.isEmpty else { return }
            var add = base
            add[kSecValueData as String] = Data(newValue.utf8)
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    static var isConfigured: Bool { !serverURL.isEmpty && !token.isEmpty }
}

struct HQClient {
    var baseURL: String = Connection.serverURL
    var token: String = Connection.token

    private func request(_ method: String, _ path: String, body: [String: Any]? = nil) async throws -> Data {
        guard let url = URL(string: baseURL + path) else { throw APIError(status: 0, message: "Invalid server URL") }
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await request("GET", path))
    }

    func me() async throws -> String {
        let obj = try JSONSerialization.jsonObject(with: try await request("GET", "/api/me")) as? [String: Any]
        return obj?["role"] as? String ?? ""
    }
    func inbox() async throws -> Inbox { try await get("/api/inbox") }
    func digest() async throws -> Digest { try await get("/api/digest") }
    func card(_ id: String) async throws -> CardDetail { try await get("/api/cards/\(id)") }
    func health() async throws -> HealthBoard { try await get("/api/health") }
    func runs() async throws -> [RunRow] { try await get("/api/runs?limit=40") }

    func decide(_ id: String, approve: Bool, reason: String? = nil) async throws {
        var b: [String: Any] = ["decision": approve ? "approved" : "rejected"]
        if let reason { b["reason"] = reason }
        _ = try await request("POST", "/api/cards/\(id)/decision", body: b)
    }
    func comment(_ id: String, _ body: String) async throws {
        _ = try await request("POST", "/api/cards/\(id)/comments", body: ["body": body])
    }
    func setStatus(_ id: String, _ status: String) async throws {
        _ = try await request("POST", "/api/cards/\(id)/status", body: ["status": status])
    }
    func setPaused(_ paused: Bool) async throws {
        _ = try await request("POST", "/api/settings", body: ["paused": paused])
    }
    func startRun(kind: String) async throws {
        _ = try await request("POST", "/api/runs", body: ["kind": kind])
    }
    func file(_ key: String) async throws -> Data {
        try await request("GET", "/api/files/\(key.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? key)")
    }
}

func relativeTime(_ iso: String) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "" }
    return RelativeDateTimeFormatter().localizedString(for: d, relativeTo: Date())
}
