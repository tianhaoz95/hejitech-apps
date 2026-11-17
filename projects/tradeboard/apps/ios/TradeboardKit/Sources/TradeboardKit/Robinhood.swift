// Robinhood on this iPhone (preview): the official Robinhood MCP (agent.robinhood.com/mcp/trading)
// with Robinhood's OAuth, the same discovery → dynamic client registration → PKCE → token flow the
// executor's MCP SDK runs (apps/executor/src/robinhood.ts), written out by hand so the app needs no
// dependency. Read-only by construction: `RobinhoodMCP.call` refuses every tool not in
// `RobinhoodMCP.readOnlyTools`, so nothing here can place, cancel or change anything.
// Tokens live in the Keychain on this device only; the board never sees them.
import CryptoKit
import Foundation
import Security

public enum RobinhoodConstants {
    public static let mcpURL = URL(string: "https://agent.robinhood.com/mcp/trading")!
    public static let loopbackPort: UInt16 = 8765
    public static let appLinkHost = "tradeboard.hejitech.workers.dev"
    public static let appLinkPath = "/oauth/robinhood/callback"
    public static let appScheme = "tradeboard"
    public static let clientName = "Tradeboard for iPhone"
}

/// Where Robinhood's sign-in sends the browser back. Robinhood's sign-in page refuses phones ("Use
/// your desktop web browser"), so `.computer` is the one that works: the owner signs in on a computer
/// and the board relays the one-time code back (services/web/src/worker/rhhandoff.ts). The others
/// stay for diagnostics.
public enum RobinhoodRedirect: String, CaseIterable, Codable, Sendable, Identifiable {
    /// <board>/oauth/robinhood/callback, opened in a computer's browser; the board relays the code.
    case computer
    /// http://127.0.0.1:8765/oauth/callback, answered by a listener in the app (what the executor uses).
    case loopback
    /// https://tradeboard.hejitech.workers.dev/oauth/robinhood/callback caught on this iPhone.
    case appLink
    /// tradeboard://robinhood-callback
    case appScheme

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .computer: return "Sign in on a computer"
        case .loopback: return "This iPhone: loopback"
        case .appLink: return "This iPhone: app link"
        case .appScheme: return "This iPhone: app scheme"
        }
    }

    /// `site` is the board (production or the local stack); only `.computer` depends on it.
    public func uri(site: URL) -> String {
        switch self {
        case .computer: return site.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + RobinhoodConstants.appLinkPath
        case .loopback: return "http://127.0.0.1:\(RobinhoodConstants.loopbackPort)/oauth/callback"
        case .appLink: return "https://\(RobinhoodConstants.appLinkHost)\(RobinhoodConstants.appLinkPath)"
        case .appScheme: return "\(RobinhoodConstants.appScheme)://robinhood-callback"
        }
    }
}

public struct RobinhoodError: LocalizedError, Equatable {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var errorDescription: String? { message }
}

// MARK: - OAuth

public struct AuthServerMetadata: Codable, Equatable, Sendable {
    public var issuer: String
    public var authorization_endpoint: String
    public var token_endpoint: String
    public var registration_endpoint: String?
    public var scopes_supported: [String]?
    public var code_challenge_methods_supported: [String]?
}

public struct RobinhoodTokens: Codable, Equatable, Sendable {
    public var accessToken: String
    public var refreshToken: String?
    public var expiresAt: Date?
}

/// Everything kept in the Keychain: one registered client per redirect URI (each registration names
/// its redirect), the redirect URI the tokens were issued for, and the tokens.
public struct RobinhoodStored: Codable, Equatable, Sendable {
    public var clients: [String: String] = [:]
    public var redirect: RobinhoodRedirect?
    public var redirectURI: String?
    public var tokens: RobinhoodTokens?
    public var signedInAt: Date?
    public init() {}
}

public enum PKCE {
    public static func verifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return base64url(Data(bytes))
    }

    public static func challenge(for verifier: String) -> String {
        base64url(Data(SHA256.hash(data: Data(verifier.utf8))))
    }

    public static func base64url(_ d: Data) -> String {
        d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}

public enum RobinhoodOAuth {
    /// `resource_metadata="…"` from a 401's WWW-Authenticate header.
    public static func resourceMetadataURL(fromWWWAuthenticate header: String?) -> URL? {
        guard let header, let r = header.range(of: "resource_metadata=\"") else { return nil }
        let rest = header[r.upperBound...]
        guard let end = rest.firstIndex(of: "\"") else { return nil }
        return URL(string: String(rest[..<end]))
    }

    /// RFC 8414 well-known location for an issuer with a path: origin + /.well-known/oauth-authorization-server + path.
    public static func authServerMetadataURL(issuer: URL) -> URL {
        var c = URLComponents()
        c.scheme = issuer.scheme
        c.host = issuer.host
        c.port = issuer.port
        let path = issuer.path == "/" ? "" : issuer.path
        c.path = "/.well-known/oauth-authorization-server" + path
        return c.url!
    }

    public static func registrationBody(redirectURI: String) -> [String: Any] {
        [
            "client_name": RobinhoodConstants.clientName,
            "redirect_uris": [redirectURI],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        ]
    }

    public static func authorizationURL(meta: AuthServerMetadata, clientId: String, redirectURI: String, challenge: String, state: String, resource: URL = RobinhoodConstants.mcpURL) -> URL? {
        guard var c = URLComponents(string: meta.authorization_endpoint) else { return nil }
        var items = c.queryItems ?? []
        items += [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "resource", value: resource.absoluteString),
        ]
        if let scopes = meta.scopes_supported, !scopes.isEmpty {
            items.append(URLQueryItem(name: "scope", value: scopes.joined(separator: " ")))
        }
        c.queryItems = items
        return c.url
    }

    public enum CallbackResult: Equatable {
        case code(String)
        case failure(String)
    }

    /// Reads the redirect Robinhood sent back: checks `state` (and `iss` when present) before taking the code.
    public static func parseCallback(_ url: URL, expectedState: String, issuer: String?) -> CallbackResult {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let value = { (n: String) in items.first(where: { $0.name == n })?.value }
        if let err = value("error") {
            let desc = value("error_description")?.replacingOccurrences(of: "+", with: " ")
            return .failure(desc.map { "\(err): \($0)" } ?? err)
        }
        guard value("state") == expectedState else { return .failure("the sign-in's state didn't match (start again)") }
        if let iss = value("iss"), let issuer, iss != issuer { return .failure("the reply came from an unexpected issuer (\(iss))") }
        guard let code = value("code"), !code.isEmpty else { return .failure("no code in the reply") }
        return .code(code)
    }

    public static func formBody(_ fields: [(String, String)]) -> Data {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return fields.map { "\($0.0)=\($0.1.addingPercentEncoding(withAllowedCharacters: allowed) ?? "")" }.joined(separator: "&").data(using: .utf8)!
    }

    public static func parseTokens(_ data: Data, now: Date = Date(), keepingRefresh old: String? = nil) throws -> RobinhoodTokens {
        guard let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw RobinhoodError("the token reply wasn't JSON") }
        guard let access = o["access_token"] as? String, !access.isEmpty else {
            let err = (o["error_description"] as? String) ?? (o["error"] as? String) ?? (o["detail"] as? String) ?? "no access_token"
            throw RobinhoodError("token exchange failed: \(err)")
        }
        let expires = (o["expires_in"] as? Double) ?? (o["expires_in"] as? Int).map(Double.init)
        return RobinhoodTokens(accessToken: access, refreshToken: (o["refresh_token"] as? String) ?? old, expiresAt: expires.map { now.addingTimeInterval($0) })
    }
}

/// The network half of the OAuth flow (discovery, registration, code exchange, refresh).
public struct RobinhoodAuthClient: Sendable {
    public var session: URLSession
    public var mcpURL: URL

    public init(session: URLSession = .shared, mcpURL: URL = RobinhoodConstants.mcpURL) {
        self.session = session
        self.mcpURL = mcpURL
    }

    /// 401 from the MCP → protected-resource metadata → authorization server metadata.
    public func discover() async throws -> AuthServerMetadata {
        var probe = URLRequest(url: mcpURL)
        probe.httpMethod = "POST"
        probe.setValue("application/json", forHTTPHeaderField: "Content-Type")
        probe.setValue("application/json, text/event-stream", forHTTPHeaderField: "Accept")
        probe.httpBody = try JSONSerialization.data(withJSONObject: RobinhoodMCP.initializeMessage(id: 1))
        let (_, resp) = try await session.data(for: probe)
        let http = resp as? HTTPURLResponse
        var resourceMeta = RobinhoodOAuth.resourceMetadataURL(fromWWWAuthenticate: http?.value(forHTTPHeaderField: "WWW-Authenticate"))
        if resourceMeta == nil {
            var c = URLComponents(url: mcpURL, resolvingAgainstBaseURL: false)!
            c.path = "/.well-known/oauth-protected-resource" + mcpURL.path
            resourceMeta = c.url
        }
        let (rmData, _) = try await session.data(from: resourceMeta!)
        guard let rm = try? JSONSerialization.jsonObject(with: rmData) as? [String: Any],
              let servers = rm["authorization_servers"] as? [String], let first = servers.first, let issuer = URL(string: first) else {
            throw RobinhoodError("Robinhood's resource metadata didn't name an authorization server")
        }
        let (asData, asResp) = try await session.data(from: RobinhoodOAuth.authServerMetadataURL(issuer: issuer))
        guard (asResp as? HTTPURLResponse)?.statusCode == 200, let meta = try? JSONDecoder().decode(AuthServerMetadata.self, from: asData) else {
            throw RobinhoodError("couldn't read Robinhood's authorization server metadata")
        }
        return meta
    }

    public func register(meta: AuthServerMetadata, redirectURI: String) async throws -> String {
        guard let endpoint = meta.registration_endpoint.flatMap(URL.init(string:)) else { throw RobinhoodError("Robinhood offers no client registration") }
        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: RobinhoodOAuth.registrationBody(redirectURI: redirectURI))
        let (data, resp) = try await session.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard (200..<300).contains(status), let id = o?["client_id"] as? String, !id.isEmpty else {
            let why = (o?["error_description"] as? String) ?? (o?["error"] as? String) ?? String(data: data, encoding: .utf8)?.prefix(200).description ?? ""
            throw RobinhoodError("Robinhood refused to register the redirect \(redirectURI) (HTTP \(status)): \(why)")
        }
        return id
    }

    public func exchange(meta: AuthServerMetadata, code: String, verifier: String, clientId: String, redirectURI: String) async throws -> RobinhoodTokens {
        try await token(meta: meta, fields: [
            ("grant_type", "authorization_code"), ("code", code), ("code_verifier", verifier),
            ("redirect_uri", redirectURI), ("client_id", clientId), ("resource", mcpURL.absoluteString),
        ], keepingRefresh: nil)
    }

    public func refresh(meta: AuthServerMetadata, tokens: RobinhoodTokens, clientId: String) async throws -> RobinhoodTokens {
        guard let rt = tokens.refreshToken else { throw RobinhoodError("Robinhood sign-in expired: sign in again") }
        return try await token(meta: meta, fields: [
            ("grant_type", "refresh_token"), ("refresh_token", rt), ("client_id", clientId), ("resource", mcpURL.absoluteString),
        ], keepingRefresh: rt)
    }

    private func token(meta: AuthServerMetadata, fields: [(String, String)], keepingRefresh: String?) async throws -> RobinhoodTokens {
        guard let url = URL(string: meta.token_endpoint) else { throw RobinhoodError("bad token endpoint") }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.httpBody = RobinhoodOAuth.formBody(fields)
        let (data, _) = try await session.data(for: req)
        return try RobinhoodOAuth.parseTokens(data, keepingRefresh: keepingRefresh)
    }
}

// MARK: - Keychain

public enum RobinhoodStore {
    // Same service as the board session, so a fresh install's cleanup (SessionStore.clearIfFreshInstall) clears it too.
    private static let service = "com.hejitech.tradeboard"
    private static let account = "robinhood.oauth"

    public static func load() -> RobinhoodStored {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account,
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess, let data = item as? Data,
              let s = try? JSONDecoder().decode(RobinhoodStored.self, from: data) else { return RobinhoodStored() }
        return s
    }

    public static func save(_ s: RobinhoodStored) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(base as CFDictionary)
        guard let data = try? JSONEncoder().encode(s) else { return }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    public static func clear() {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account] as CFDictionary)
    }
}

// MARK: - MCP (Streamable HTTP)

public struct ToolCallFailed: LocalizedError {
    public let message: String
    public var errorDescription: String? { message }
}

public struct Unauthorized: Error {}

/// A minimal MCP client over Streamable HTTP: initialize, tools/list, tools/call (read-only tools only).
public final class RobinhoodMCP: @unchecked Sendable {
    /// The only tools this app will ever call. Order, cancel, alert, watchlist and settings tools are refused before any request.
    public static let readOnlyTools: Set<String> = ["get_accounts", "get_trade_approval_setting", "get_equity_quotes"]
    public static let protocolVersion = "2025-06-18"

    private let url: URL
    private let session: URLSession
    private let accessToken: String
    private var sessionId: String?
    private var nextId = 1
    private var negotiatedVersion = RobinhoodMCP.protocolVersion

    public init(accessToken: String, url: URL = RobinhoodConstants.mcpURL, session: URLSession = .shared) {
        self.accessToken = accessToken
        self.url = url
        self.session = session
    }

    public static func initializeMessage(id: Int) -> [String: Any] {
        [
            "jsonrpc": "2.0", "id": id, "method": "initialize",
            "params": ["protocolVersion": protocolVersion, "capabilities": [String: Any](), "clientInfo": ["name": "tradeboard-ios", "version": "0.1"]],
        ]
    }

    public func initialize() async throws {
        let r = try await request(RobinhoodMCP.initializeMessage(id: takeId()))
        if let v = (r["result"] as? [String: Any])?["protocolVersion"] as? String { negotiatedVersion = v }
        _ = try await send(["jsonrpc": "2.0", "method": "notifications/initialized"], expectReply: false)
    }

    public func listTools() async throws -> [String] {
        var names: [String] = []
        var cursor: String?
        repeat {
            var params: [String: Any] = [:]
            if let cursor { params["cursor"] = cursor }
            let r = try await request(["jsonrpc": "2.0", "id": takeId(), "method": "tools/list", "params": params])
            let result = r["result"] as? [String: Any]
            names += ((result?["tools"] as? [[String: Any]]) ?? []).compactMap { $0["name"] as? String }
            cursor = result?["nextCursor"] as? String
        } while cursor != nil && names.count < 1000
        return names
    }

    /// A read-only tool call; returns the tool's structured content or its text parsed as JSON.
    public func call(_ name: String, _ args: [String: Any] = [:]) async throws -> Any {
        guard Self.readOnlyTools.contains(name) else { throw ToolCallFailed(message: "\(name) isn't a read-only tool; this app never calls it") }
        let r = try await request(["jsonrpc": "2.0", "id": takeId(), "method": "tools/call", "params": ["name": name, "arguments": args]])
        return try Self.toolValue(r, name: name)
    }

    public static func toolValue(_ reply: [String: Any], name: String) throws -> Any {
        if let err = reply["error"] as? [String: Any] { throw ToolCallFailed(message: "\(name): \(err["message"] as? String ?? "error")") }
        guard let result = reply["result"] as? [String: Any] else { throw ToolCallFailed(message: "\(name): no result") }
        let text = ((result["content"] as? [[String: Any]]) ?? []).first(where: { $0["type"] as? String == "text" })?["text"] as? String ?? ""
        if result["isError"] as? Bool == true { throw ToolCallFailed(message: "\(name): \(text.prefix(300))") }
        if let s = result["structuredContent"] { return s }
        guard let d = text.data(using: .utf8), let v = try? JSONSerialization.jsonObject(with: d, options: [.fragmentsAllowed]) else {
            throw ToolCallFailed(message: "\(name): unreadable reply")
        }
        return v
    }

    private func takeId() -> Int {
        defer { nextId += 1 }
        return nextId
    }

    private func request(_ msg: [String: Any]) async throws -> [String: Any] {
        guard let r = try await send(msg, expectReply: true) else { throw ToolCallFailed(message: "no reply") }
        return r
    }

    private func send(_ msg: [String: Any], expectReply: Bool) async throws -> [String: Any]? {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 30
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json, text/event-stream", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        if let sessionId { req.setValue(sessionId, forHTTPHeaderField: "Mcp-Session-Id") }
        if msg["method"] as? String != "initialize" { req.setValue(negotiatedVersion, forHTTPHeaderField: "MCP-Protocol-Version") }
        req.httpBody = try JSONSerialization.data(withJSONObject: msg)
        let (data, resp) = try await session.data(for: req)
        let http = resp as? HTTPURLResponse
        if http?.statusCode == 401 { throw Unauthorized() }
        if let sid = http?.value(forHTTPHeaderField: "Mcp-Session-Id") { sessionId = sid }
        guard let status = http?.statusCode, (200..<300).contains(status) else {
            throw ToolCallFailed(message: "Robinhood MCP returned HTTP \(http?.statusCode ?? 0): \(String(data: data, encoding: .utf8)?.prefix(200) ?? "")")
        }
        guard expectReply else { return nil }
        return try Self.parseReply(data, contentType: http?.value(forHTTPHeaderField: "Content-Type"), id: msg["id"] as? Int)
    }

    /// A JSON-RPC reply sent either as plain JSON or as a server-sent event stream.
    public static func parseReply(_ data: Data, contentType: String?, id: Int?) throws -> [String: Any] {
        if contentType?.contains("text/event-stream") == true {
            let text = String(decoding: data, as: UTF8.self).replacingOccurrences(of: "\r\n", with: "\n")
            for event in text.components(separatedBy: "\n\n") {
                let payload = event.split(separator: "\n").filter { $0.hasPrefix("data:") }.map { $0.dropFirst(5).trimmingCharacters(in: .whitespaces) }.joined(separator: "\n")
                guard !payload.isEmpty, let d = payload.data(using: .utf8),
                      let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { continue }
                if id == nil || (o["id"] as? Int) == id { return o }
            }
            throw ToolCallFailed(message: "no reply in the event stream")
        }
        guard let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw ToolCallFailed(message: "reply wasn't JSON") }
        return o
    }
}

// MARK: - Reading replies (the executor's defensive parsing, brokerage.ts)

public enum RobinhoodParse {
    public static func unwrap(_ v: Any) -> Any {
        if let o = v as? [String: Any], let d = o["data"] { return d }
        return v
    }

    /// The first array of objects found breadth-first whose items satisfy `pick`.
    public static func findArray(_ v: Any, _ pick: ([String: Any]) -> Bool) -> [[String: Any]] {
        var queue: [Any] = [v]
        while !queue.isEmpty {
            let cur = queue.removeFirst()
            if let arr = cur as? [Any] {
                let objs = arr.compactMap { $0 as? [String: Any] }
                if !objs.isEmpty && objs.contains(where: pick) { return objs }
                queue += arr
            } else if let o = cur as? [String: Any] {
                queue += o.keys.sorted().compactMap { o[$0] }
            }
        }
        return []
    }

    /// First value under any of `keys`, searched breadth-first.
    public static func findKey(_ v: Any, _ keys: [String]) -> Any? {
        var queue: [Any] = [v]
        while !queue.isEmpty {
            let cur = queue.removeFirst()
            if let o = cur as? [String: Any] {
                for k in keys { if let x = o[k] { return x } }
                queue += o.keys.sorted().compactMap { o[$0] }
            } else if let arr = cur as? [Any] {
                queue += arr
            }
        }
        return nil
    }

    public static func number(_ v: Any?) -> Double? {
        if let d = v as? Double { return d.isFinite ? d : nil }
        if let i = v as? Int { return Double(i) }
        if let s = v as? String, let d = Double(s), d.isFinite { return d }
        return nil
    }

    /// Only the last four digits ever leave this function.
    public static func mask(_ account: String) -> String {
        "••••" + String(account.suffix(4))
    }

    public struct AccountRow: Equatable, Sendable {
        public var number: String
        public var agenticAllowed: Bool
        public var masked: String { RobinhoodParse.mask(number) }
    }

    public static func accounts(_ raw: Any) -> [AccountRow] {
        findArray(unwrap(raw)) { $0["account_number"] != nil }.compactMap { r in
            guard let n = r["account_number"].map({ "\($0)" }), !n.isEmpty else { return nil }
            return AccountRow(number: n, agenticAllowed: r["agentic_allowed"] as? Bool == true)
        }
    }

    public static func approvals(_ raw: Any) -> String {
        let v = findKey(unwrap(raw), ["trade_approvals_enabled", "approvals_enabled", "requires_approval", "approval_required", "enabled", "trade_approval_enabled"])
        if let b = v as? Bool { return b ? "on" : "off" }
        let s = ((v as? String) ?? (findKey(unwrap(raw), ["setting", "status", "state"]) as? String) ?? "").lowercased()
        if ["on", "enabled", "required", "true"].contains(s) { return "on" }
        if ["off", "disabled", "not_required", "false"].contains(s) { return "off" }
        return "unknown"
    }

    /// The current price per Robinhood's guide: the newer of the regular and extended-hours last trade.
    public static func quotePrice(_ raw: Any, symbol: String) throws -> Double {
        let results = findArray(unwrap(raw)) { $0["quote"] != nil || $0["last_trade_price"] != nil }
        let entry = results.first(where: { (($0["quote"] as? [String: Any])?["symbol"] as? String ?? $0["symbol"] as? String) == symbol }) ?? results.first
        guard let q = (entry?["quote"] as? [String: Any]) ?? entry, q["symbol"] as? String == symbol else { throw RobinhoodError("no quote for \(symbol)") }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        let date = { (s: Any?) -> Date? in (s as? String).flatMap { iso.date(from: $0) ?? plain.date(from: $0) } }
        let reg = (number(q["last_trade_price"]), date(q["venue_last_trade_time"] ?? q["updated_at"]))
        let ext = (number(q["last_non_reg_trade_price"]), date(q["venue_last_non_reg_trade_time"]))
        let useExt = ext.0 != nil && ext.1 != nil && (reg.1 == nil || ext.1! > reg.1!)
        guard let p = useExt ? ext.0 : reg.0, p > 0 else { throw RobinhoodError("no price for \(symbol)") }
        return p
    }
}

// MARK: - Sign in on a computer (the board relays the code; rhhandoff.ts)

public struct RobinhoodHandoffStart: Codable, Equatable, Sendable {
    public var short: String
    public var link: String
    public var expires_at: String
}

public struct RobinhoodHandoffStatus: Codable, Equatable, Sendable {
    /// pending | done | error
    public var status: String
    public var code: String?
    public var iss: String?
    public var error: String?
    public var expires_at: String?
}
