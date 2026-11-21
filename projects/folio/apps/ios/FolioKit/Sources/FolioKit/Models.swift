import Foundation

// What the Folio Worker's REST API (/api/*) returns. Fields the app doesn't need are left out, and
// most are optional so an older app keeps working when the server adds or drops one.

public enum Role: String, Codable, Sendable, CaseIterable {
    case owner, editor, viewer

    public var canEdit: Bool { self != .viewer }
    public var canReview: Bool { self != .viewer }
    public var label: String { rawValue.capitalized }
}

public enum Visibility: String, Codable, Sendable {
    case `private`, link
}

public struct ArtifactSummary: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var slug: String
    public var title: String
    public var description: String
    public var visibility: Visibility
    public var role: Role
    public var head_version: Int
    public var open_suggestions: Int
    public var updated_at: Date
    public var created_at: Date
}

public struct Artifact: Codable, Hashable, Sendable {
    public var id: String
    public var slug: String
    public var title: String
    public var description: String
    public var visibility: Visibility
    public var head_version: Int
    public var updated_at: Date?
}

public struct VersionHead: Codable, Hashable, Sendable {
    public var number: Int
    public var message: String
    public var agent: String
    public var model: String?
    public var kind: String?
    public var created_at: Date
}

public struct FileView: Codable, Hashable, Sendable, Identifiable {
    public var path: String
    public var type: String
    public var size: Int
    public var text: Bool?
    public var id: String { path }
}

public struct ArtifactDetail: Codable, Hashable, Sendable {
    public var artifact: Artifact
    public var role: Role?
    public var head: VersionHead
    public var files: [FileView]
    public var open_suggestions: Int
    public var unresolved_comments: Int
    public var mcp_url: String?
}

public struct Version: Codable, Hashable, Identifiable, Sendable {
    public var number: Int
    public var parent: Int?
    public var message: String
    public var agent: String
    public var model: String?
    public var via: String?
    public var kind: String?
    public var restored_from: Int?
    public var created_at: Date
    public var files: Int?
    public var id: Int { number }
}

public enum SuggestionStatus: String, Codable, Sendable {
    case open, accepted, rejected, withdrawn
}

public struct Suggestion: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var number: Int
    public var base_version: Int
    public var title: String
    public var rationale: String
    public var status: SuggestionStatus
    public var agent: String
    public var model: String?
    public var resolved_agent: String?
    public var resolution_note: String?
    public var result_version: Int?
    public var created_at: Date
    public var resolved_at: Date?
}

public struct DiffLine: Codable, Hashable, Sendable {
    public enum Kind: String, Codable, Sendable { case same, add, del }
    public var kind: Kind
    public var text: String
    public var a: Int?
    public var b: Int?
}

public struct Hunk: Codable, Hashable, Sendable {
    public var aStart: Int
    public var aLines: Int
    public var bStart: Int
    public var bLines: Int
    public var lines: [DiffLine]
}

public struct FileDiff: Codable, Hashable, Sendable, Identifiable {
    public enum Status: String, Codable, Sendable { case added, deleted, modified, renamed, binary }
    public var path: String
    public var status: Status
    public var from: String?
    public var hunks: [Hunk]
    public var added: Int
    public var removed: Int
    public var truncated: Bool?
    public var id: String { path }
}

public struct SuggestionDetail: Codable, Hashable, Sendable {
    public var suggestion: Suggestion
    public var files: [FileDiff]
    public var applies_to_head: Bool
    public var head_version: Int
}

public struct VersionDiff: Codable, Hashable, Sendable {
    public var from: Int
    public var to: Int
    public var files: [FileDiff]
}

public struct CommentAnchor: Codable, Hashable, Sendable {
    public var selector: String?
    public var text: String?
    public var line: Int?
    public var end_line: Int?

    public init(selector: String? = nil, text: String? = nil, line: Int? = nil, end_line: Int? = nil) {
        self.selector = selector
        self.text = text
        self.line = line
        self.end_line = end_line
    }

    /// The request body's `anchor`, or nil when there's nothing to point at.
    public var json: [String: Any]? {
        var d: [String: Any] = [:]
        if let selector, !selector.isEmpty { d["selector"] = selector }
        if let text, !text.isEmpty { d["text"] = text }
        if let line { d["line"] = line }
        if let end_line { d["end_line"] = end_line }
        return d.isEmpty ? nil : d
    }
}

public struct Comment: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var body: String
    public var agent: String
    public var model: String?
    public var version: Int?
    public var path: String?
    public var anchor: CommentAnchor?
    public var reply_to: String?
    public var resolved: Bool
    public var created_at: Date
    public var suggestion: Int?
}

public struct ArtifactRef: Codable, Hashable, Sendable {
    public var slug: String
    public var title: String
}

public struct ActivityEvent: Codable, Hashable, Identifiable, Sendable {
    public var id: Int
    public var kind: String
    public var version: Int?
    public var suggestion_number: Int?
    public var agent: String
    public var via: String?
    public var summary: String
    public var created_at: Date
    public var artifact: ArtifactRef?
}

public struct EventPage: Codable, Hashable, Sendable {
    public var head_version: Int
    public var events: [ActivityEvent]
}

public struct Member: Codable, Hashable, Identifiable, Sendable {
    public var user_id: String
    public var role: Role
    public var email: String?
    public var id: String { user_id }
}

public struct Invite: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var role: Role
    public var uses: Int?
    public var expires_at: Date?
    public var created_at: Date
}

public struct Owner: Codable, Hashable, Sendable {
    public var id: String
    public var email: String?
}

public struct Sharing: Codable, Hashable, Sendable {
    public var owner: Owner
    public var members: [Member]
    public var invites: [Invite]
    public var visibility: Visibility
}

public struct NewInvite: Codable, Hashable, Sendable {
    public var url: String
    public var role: Role
    public var expires_at: Date?
}

public struct AgentToken: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var name: String
    public var created_at: Date
    public var last_used_at: Date?
}

public struct NewToken: Codable, Hashable, Sendable {
    public var id: String
    public var token: String
}

public struct Created: Codable, Hashable, Sendable {
    public var slug: String
    public var version: Int
}

public struct PushPrefs: Codable, Hashable, Sendable {
    public var suggestions: Bool
    public var comments: Bool
    public var edits: Bool

    public init(suggestions: Bool = true, comments: Bool = true, edits: Bool = true) {
        self.suggestions = suggestions
        self.comments = comments
        self.edits = edits
    }
}

/// A file to create an artifact with: text, or bytes sent as base64.
public struct NewFile: Hashable, Sendable {
    public var path: String
    public var content: String?
    public var data: Data?

    public init(path: String, content: String) {
        self.path = path
        self.content = content
    }

    public init(path: String, data: Data) {
        self.path = path
        self.data = data
    }

    var json: [String: String] {
        if let content { return ["path": path, "content": content] }
        return ["path": path, "base64": (data ?? Data()).base64EncodedString()]
    }
}

extension JSONDecoder {
    /// Postgres timestamps (`2026-11-18T05:51:45.123456+00:00`) and plain ISO 8601.
    public static let folio: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            if let date = FolioDate.parse(s) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "bad date \(s)"))
        }
        return d
    }()
}

public enum FolioDate {
    nonisolated(unsafe) private static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    nonisolated(unsafe) private static let plain = ISO8601DateFormatter()

    public static func parse(_ raw: String) -> Date? {
        var s = raw.replacingOccurrences(of: " ", with: "T")
        // Keep at most milliseconds: the formatter doesn't take microseconds.
        if let dot = s.firstIndex(of: ".") {
            let rest = s[s.index(after: dot)...]
            let digits = rest.prefix { $0.isNumber }
            let zone = rest.dropFirst(digits.count)
            s = String(s[..<dot]) + "." + String(digits.prefix(3)).padding(toLength: 3, withPad: "0", startingAt: 0) + zone
        }
        if s.hasSuffix("+00") { s += ":00" }
        return fractional.date(from: s) ?? plain.date(from: s)
    }
}

/// Which of an artifact's files a preview page is showing: its URL under the render base
/// (`…/r/<slug>/<version>/<key>/`), decoded. Nil for the base itself (the entry file) or a page
/// outside it.
public enum RenderPath {
    public static func file(of url: URL, base: URL) -> String? {
        let b = base.absoluteString, u = url.absoluteString
        guard u.hasPrefix(b) else { return nil }
        var rest = String(u.dropFirst(b.count))
        if let cut = rest.firstIndex(where: { $0 == "?" || $0 == "#" }) { rest = String(rest[..<cut]) }
        rest = rest.removingPercentEncoding ?? rest
        return rest.isEmpty ? nil : rest
    }
}
