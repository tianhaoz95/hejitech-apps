// HQ's API models as the iPhone app uses them (projects/hq/services/web/src/worker/api.ts).
// Models mirror @hq/core's card schema (projects/hq/packages/core/src/card.ts).
import Foundation

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
    var figures: [Figure]?
    var request_id: String?
}

struct Inbox: Codable {
    var cap: Int
    var decide: [Card]
    var backlog: [Card]
    var discussing: [Card]
    var ready: [Card]
    var working: [Card]
    var reject_reasons: [String]
    var requests: [HQRequest]?
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
    /// Decodes anything and keeps nothing (for objects we only need the keys of).
    struct Ignored: Decodable { init(from decoder: Decoder) throws {} }
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

struct Workspace: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var repo: String
    var role: String
    var paused: Bool?
    var synced_at: String?
}

struct Me: Codable {
    struct User: Codable { var id: String; var email: String? }
    var user: User
    var workspaces: [Workspace]
}

struct Member: Codable, Identifiable, Hashable {
    var user_id: String
    var role: String
    var email: String?
    var id: String { user_id }
}

struct Invite: Codable {
    var code: String
    var role: String
    var expires_at: String
}

/// HQ's API for the signed-in person, in the current workspace ("~/…").
struct HQClient {
    private var b: Backend { .shared }

    func me() async throws -> Me { try await b.get("/api/me") }
    func createWorkspace(name: String, repo: String) async throws -> Workspace {
        try JSONDecoder().decode(Workspace.self, from: try await b.request("POST", "/api/workspaces", body: ["name": name, "repo": repo]))
    }
    func acceptInvite(_ code: String) async throws -> Workspace {
        try JSONDecoder().decode(Workspace.self, from: try await b.request("POST", "/api/invites/accept", body: ["code": code]))
    }
    func inbox() async throws -> Inbox { try await b.get("~/inbox") }
    func digest() async throws -> Digest { try await b.get("~/digest") }
    func card(_ id: String) async throws -> CardDetail { try await b.get("~/cards/\(id)") }
    func health() async throws -> HealthBoard { try await b.get("~/health") }
    func runs() async throws -> [RunRow] { try await b.get("~/runs?limit=40") }
    func members() async throws -> [Member] { try await b.get("~/members") }

    // Requests: ask HQ for something; an agent answers with cards, a question or a reason.
    func requests() async throws -> [HQRequest] { try await b.get("~/requests?limit=100") }
    func request(_ id: String) async throws -> RequestDetail { try await b.get("~/requests/\(id)") }
    func ask(_ text: String, project: String?) async throws -> RequestDetail {
        var body: [String: Any] = ["body": text]
        if let project { body["project"] = project }
        return try JSONDecoder().decode(RequestDetail.self, from: try await b.request("POST", "~/requests", body: body))
    }
    func replyToRequest(_ id: String, _ text: String) async throws -> RequestDetail {
        try JSONDecoder().decode(RequestDetail.self, from: try await b.request("POST", "~/requests/\(id)/messages", body: ["body": text]))
    }
    func closeRequest(_ id: String) async throws -> RequestDetail {
        try JSONDecoder().decode(RequestDetail.self, from: try await b.request("POST", "~/requests/\(id)/close"))
    }
    func retryRequest(_ id: String) async throws { _ = try await b.request("POST", "~/requests/\(id)/retry") }
    /// The projects HQ manages in this workspace (from the synced policy), for the Ask picker.
    func projects() async throws -> [String] {
        struct Config: Decodable { struct Policy: Decodable { var projects: [String: JSONValue.Ignored] }; var policy: Policy? }
        let c: Config? = try await b.get("~/config")
        return (c?.policy?.projects.keys).map { Array($0).sorted() } ?? []
    }

    func decide(_ id: String, approve: Bool, reason: String? = nil) async throws {
        var body: [String: Any] = ["decision": approve ? "approved" : "rejected"]
        if let reason { body["reason"] = reason }
        _ = try await b.request("POST", "~/cards/\(id)/decision", body: body)
    }
    func comment(_ id: String, _ text: String) async throws { _ = try await b.request("POST", "~/cards/\(id)/comments", body: ["body": text]) }
    func setStatus(_ id: String, _ status: String) async throws { _ = try await b.request("POST", "~/cards/\(id)/status", body: ["status": status]) }
    func setPaused(_ paused: Bool) async throws { _ = try await b.request("POST", "~/settings", body: ["paused": paused]) }
    func startRun(kind: String) async throws { _ = try await b.request("POST", "~/runs", body: ["kind": kind]) }
    func invite(role: String) async throws -> Invite {
        try JSONDecoder().decode(Invite.self, from: try await b.request("POST", "~/invites", body: ["role": role]))
    }
    /// Deletes the person's HQ data (App Store guideline 5.1.1(v)); see the privacy policy.
    func deleteAccount(appleAuthorizationCode: String?) async throws {
        var body: [String: Any] = [:]
        if let appleAuthorizationCode { body["apple_authorization_code"] = appleAuthorizationCode }
        _ = try await b.request("DELETE", "/api/me", body: body)
    }
    func file(_ key: String) async throws -> Data {
        try await b.request("GET", "~/files/\(key.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? key)")
    }
}

func relativeTime(_ iso: String) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "" }
    // A server clock slightly ahead of the phone's would read "in 0 seconds".
    return RelativeDateTimeFormatter().localizedString(for: min(d, Date()), relativeTo: Date())
}
