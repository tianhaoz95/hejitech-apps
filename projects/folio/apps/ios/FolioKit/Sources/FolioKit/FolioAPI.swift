import Foundation

/// An error the Worker explained (`{ error, code }`), or a transport failure.
public struct APIError: LocalizedError, Equatable, Sendable {
    public var status: Int
    public var code: String?
    public var message: String

    public var errorDescription: String? { message }
    public var isStale: Bool { code == "stale" || status == 409 }
    public var isSignedOut: Bool { status == 401 }
}

/// The Folio REST API as the web app uses it, signed in with the person's Supabase session. Every
/// change carries `X-Folio-Client: iPhone`, so versions, comments and reviews read "iPhone".
public struct FolioAPI: Sendable {
    public let auth: SupabaseAuth
    public var config: ServerConfig { auth.config }
    private let http: URLSession

    public init(auth: SupabaseAuth, http: URLSession = .shared) {
        self.auth = auth
        self.http = http
    }

    // MARK: artifacts

    public func artifacts(query: String? = nil) async throws -> [ArtifactSummary] {
        try await get("api/artifacts", query.map { ["q": $0] } ?? [:])
    }

    public func artifact(_ slug: String) async throws -> ArtifactDetail {
        try await get("api/artifacts/\(enc(slug))")
    }

    public func create(title: String, description: String = "", files: [NewFile], message: String? = nil) async throws -> Created {
        var body: [String: Any] = ["title": title, "description": description, "files": files.map(\.json)]
        if let message { body["message"] = message }
        return try await send("POST", "api/artifacts", body)
    }

    public func update(_ slug: String, title: String? = nil, description: String? = nil, visibility: Visibility? = nil) async throws {
        var body: [String: Any] = [:]
        if let title { body["title"] = title }
        if let description { body["description"] = description }
        if let visibility { body["visibility"] = visibility.rawValue }
        let _: Ignored = try await send("PATCH", "api/artifacts/\(enc(slug))", body)
    }

    public func delete(_ slug: String) async throws {
        let _: Ignored = try await send("DELETE", "api/artifacts/\(enc(slug))", nil)
    }

    /// Stars or unstars an artifact for the signed-in person.
    public func setFavorite(_ slug: String, _ on: Bool) async throws {
        let _: Ignored = try await send(on ? "POST" : "DELETE", "api/artifacts/\(enc(slug))/favorite", on ? [:] : nil)
    }

    /// A signed URL that renders a version (or a suggestion's preview) in the sandbox.
    public func renderURL(_ slug: String, version: Int? = nil, suggestion: Int? = nil) async throws -> URL {
        var q: [String: String] = [:]
        if let version { q["version"] = String(version) }
        if let suggestion { q["suggestion"] = String(suggestion) }
        struct R: Decodable { var url: String }
        let r: R = try await get("api/artifacts/\(enc(slug))/render", q)
        guard let u = URL(string: r.url) else { throw APIError(status: 0, code: nil, message: "Bad preview link.") }
        return u
    }

    public func webURL(_ slug: String) -> URL { config.site.appendingPathComponent("a/\(slug)") }

    public func versions(_ slug: String) async throws -> [Version] {
        try await get("api/artifacts/\(enc(slug))/versions")
    }

    public func diff(_ slug: String, from: Int, to: Int) async throws -> VersionDiff {
        try await get("api/artifacts/\(enc(slug))/diff", ["from": String(from), "to": String(to)])
    }

    public func restore(_ slug: String, version: Int) async throws -> Int {
        struct R: Decodable { var version: Int }
        let r: R = try await send("POST", "api/artifacts/\(enc(slug))/restore", ["version": version])
        return r.version
    }

    public func fork(_ slug: String, version: Int? = nil) async throws -> Created {
        var body: [String: Any] = [:]
        if let version { body["version"] = version }
        return try await send("POST", "api/artifacts/\(enc(slug))/fork", body)
    }

    public func file(_ slug: String, path: String, version: Int? = nil) async throws -> String {
        struct R: Decodable { var content: String? }
        var q = ["path": path]
        if let version { q["version"] = String(version) }
        let r: R = try await get("api/artifacts/\(enc(slug))/file", q)
        return r.content ?? ""
    }

    /// Downloads the version as a .zip into a temporary file (for the share sheet).
    public func exportZip(_ slug: String, title: String, version: Int) async throws -> URL {
        let data = try await raw("GET", "api/artifacts/\(enc(slug))/export.zip", query: ["version": String(version)], body: nil)
        let name = title.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator: "-").lowercased()
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(name.isEmpty ? slug : name)-v\(version).zip")
        try data.write(to: url, options: .atomic)
        return url
    }

    // MARK: suggestions

    public func suggestions(_ slug: String, status: String = "all") async throws -> [Suggestion] {
        try await get("api/artifacts/\(enc(slug))/suggestions", ["status": status])
    }

    public func suggestion(_ slug: String, number: Int) async throws -> SuggestionDetail {
        try await get("api/artifacts/\(enc(slug))/suggestions/\(number)")
    }

    public enum Decision: String, Sendable { case accept, reject }

    /// Accepts (making a version) or rejects; returns the new version when accepted.
    @discardableResult
    public func review(_ slug: String, number: Int, _ decision: Decision, note: String? = nil) async throws -> Int? {
        struct R: Decodable { var status: String; var version: Int? }
        var body: [String: Any] = ["decision": decision.rawValue]
        if let note, !note.isEmpty { body["note"] = note }
        let r: R = try await send("POST", "api/artifacts/\(enc(slug))/suggestions/\(number)/review", body)
        return r.version
    }

    // MARK: comments

    public func comments(_ slug: String, resolved: Bool = false, suggestion: Int? = nil) async throws -> [Comment] {
        var q: [String: String] = [:]
        if resolved { q["resolved"] = "1" }
        if let suggestion { q["suggestion"] = String(suggestion) }
        return try await get("api/artifacts/\(enc(slug))/comments", q)
    }

    @discardableResult
    public func comment(_ slug: String, body text: String, path: String? = nil, anchor: CommentAnchor? = nil, version: Int? = nil, suggestion: Int? = nil, replyTo: String? = nil) async throws -> Comment {
        var body: [String: Any] = ["body": text]
        if let path { body["path"] = path }
        if let a = anchor?.json { body["anchor"] = a }
        if let version { body["version"] = version }
        if let suggestion { body["suggestion"] = suggestion }
        if let replyTo { body["reply_to"] = replyTo }
        return try await send("POST", "api/artifacts/\(enc(slug))/comments", body)
    }

    public func resolve(_ slug: String, comment id: String, resolved: Bool = true) async throws {
        let _: Ignored = try await send("POST", "api/artifacts/\(enc(slug))/comments/\(id)/resolve", ["resolved": resolved])
    }

    // MARK: activity

    public func activity(since: Date? = nil) async throws -> [ActivityEvent] {
        try await get("api/activity", since.map { ["since": ISO8601DateFormatter().string(from: $0)] } ?? [:])
    }

    public func events(_ slug: String, after: Int = 0) async throws -> EventPage {
        try await get("api/artifacts/\(enc(slug))/events", ["after": String(after)])
    }

    // MARK: sharing

    public func sharing(_ slug: String) async throws -> Sharing {
        try await get("api/artifacts/\(enc(slug))/sharing")
    }

    public func invite(_ slug: String, role: Role, days: Int? = 14) async throws -> NewInvite {
        var body: [String: Any] = ["role": role.rawValue]
        if let days { body["expires_in_days"] = days }
        return try await send("POST", "api/artifacts/\(enc(slug))/invites", body)
    }

    public func revokeInvite(_ slug: String, id: String) async throws {
        let _: Ignored = try await send("DELETE", "api/artifacts/\(enc(slug))/invites/\(id)", nil)
    }

    public func removeMember(_ slug: String, userId: String) async throws {
        let _: Ignored = try await send("DELETE", "api/artifacts/\(enc(slug))/members/\(userId)", nil)
    }

    public func setRole(_ slug: String, userId: String, role: Role) async throws {
        let _: Ignored = try await send("PATCH", "api/artifacts/\(enc(slug))/members/\(userId)", ["role": role.rawValue])
    }

    public func acceptInvite(token: String) async throws -> String {
        struct R: Decodable { var slug: String }
        let r: R = try await send("POST", "api/invites/accept", ["token": token])
        return r.slug
    }

    // MARK: agents, notifications, account

    public func tokens() async throws -> [AgentToken] { try await get("api/tokens") }

    public func makeToken(name: String) async throws -> NewToken {
        try await send("POST", "api/tokens", ["name": name])
    }

    public func revokeToken(_ id: String) async throws {
        let _: Ignored = try await send("DELETE", "api/tokens/\(id)", nil)
    }

    @discardableResult
    public func registerPush(token: String, sandbox: Bool, prefs: PushPrefs) async throws -> PushPrefs {
        try await send("POST", "api/push", ["token": token, "sandbox": sandbox, "suggestions": prefs.suggestions, "comments": prefs.comments, "edits": prefs.edits])
    }

    public func unregisterPush(token: String) async throws {
        let _: Ignored = try await send("DELETE", "api/push/\(token)", nil)
    }

    /// Deletes everything Folio keeps for the person (their artifacts, memberships, tokens, devices).
    /// The sign-in itself is shared with other HEJI apps and stays.
    public func deleteAccountData() async throws {
        let _: Ignored = try await send("DELETE", "api/account", nil)
    }

    // MARK: plumbing

    private struct Ignored: Decodable {}

    private func enc(_ s: String) -> String { s.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? s }

    private func get<T: Decodable>(_ path: String, _ query: [String: String] = [:]) async throws -> T {
        try decode(try await raw("GET", path, query: query, body: nil))
    }

    private func send<T: Decodable>(_ method: String, _ path: String, _ body: [String: Any]?) async throws -> T {
        try decode(try await raw(method, path, query: [:], body: body))
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try JSONDecoder.folio.decode(T.self, from: data.isEmpty ? Data("{}".utf8) : data)
        } catch {
            throw APIError(status: 0, code: "decode", message: "Folio sent something this version of the app can't read. Update the app, or try again.")
        }
    }

    private func raw(_ method: String, _ path: String, query: [String: String], body: [String: Any]?, retried: Bool = false) async throws -> Data {
        var c = URLComponents(url: config.site.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { c.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) } }
        var req = URLRequest(url: c.url!)
        req.httpMethod = method
        req.timeoutInterval = 30
        req.setValue("iPhone", forHTTPHeaderField: "X-Folio-Client")
        if let token = try await auth.accessToken() { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let data: Data
        let resp: URLResponse
        do {
            (data, resp) = try await http.data(for: req)
        } catch {
            throw APIError(status: 0, code: "offline", message: "Can't reach Folio. Check your connection and try again.")
        }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401, !retried, await auth.current != nil {
            _ = try await auth.refresh()
            return try await raw(method, path, query: query, body: body, retried: true)
        }
        guard (200..<300).contains(status) else {
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            throw APIError(status: status, code: obj?["code"] as? String,
                           message: (obj?["error"] as? String) ?? "Folio couldn't do that (\(status)).")
        }
        return data
    }
}
