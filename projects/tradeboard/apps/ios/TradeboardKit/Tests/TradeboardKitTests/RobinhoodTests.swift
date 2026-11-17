import Foundation
import Testing
@testable import TradeboardKit

@Suite struct RobinhoodTests {
    @Test func readsResourceMetadataFromWWWAuthenticate() {
        let h = #"Bearer resource_metadata="https://agent.robinhood.com/.well-known/oauth-protected-resource/mcp/trading""#
        #expect(RobinhoodOAuth.resourceMetadataURL(fromWWWAuthenticate: h)?.absoluteString == "https://agent.robinhood.com/.well-known/oauth-protected-resource/mcp/trading")
        #expect(RobinhoodOAuth.resourceMetadataURL(fromWWWAuthenticate: "Bearer") == nil)
    }

    @Test func authServerMetadataURLKeepsIssuerPath() {
        let u = RobinhoodOAuth.authServerMetadataURL(issuer: URL(string: "https://agent.robinhood.com/mcp/trading")!)
        #expect(u.absoluteString == "https://agent.robinhood.com/.well-known/oauth-authorization-server/mcp/trading")
    }

    @Test func pkceChallengeIsS256() {
        // Checked against `openssl dgst -sha256 -binary | base64url`.
        #expect(PKCE.challenge(for: "dBjftJeZ4CVP-mJ92K1jhYQIQGTCMrLMiSjApoqewOc") == "xTM6g5XKmu-Gb7l2x5FiHw-PntdE5a9Jnd2u5jyYQX0")
        #expect(PKCE.verifier().count >= 43)
    }

    @Test func authorizationURLCarriesPKCEStateResourceScope() throws {
        let meta = AuthServerMetadata(issuer: "https://agent.robinhood.com/mcp/trading", authorization_endpoint: "https://robinhood.com/oauth", token_endpoint: "https://api.robinhood.com/oauth2/token/", registration_endpoint: nil, scopes_supported: ["internal"], code_challenge_methods_supported: ["S256"])
        let u = try #require(RobinhoodOAuth.authorizationURL(meta: meta, clientId: "c1", redirect: .loopback, challenge: "ch", state: "st"))
        let q = Dictionary(uniqueKeysWithValues: (URLComponents(url: u, resolvingAgainstBaseURL: false)?.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        #expect(q["client_id"] == "c1")
        #expect(q["code_challenge_method"] == "S256")
        #expect(q["redirect_uri"] == "http://127.0.0.1:8765/oauth/callback")
        #expect(q["state"] == "st")
        #expect(q["resource"] == "https://agent.robinhood.com/mcp/trading")
        #expect(q["scope"] == "internal")
    }

    @Test func callbackChecksStateAndIssuer() {
        let iss = "https://agent.robinhood.com/mcp/trading"
        let ok = URL(string: "http://127.0.0.1:8765/oauth/callback?code=abc&state=s1&iss=https%3A%2F%2Fagent.robinhood.com%2Fmcp%2Ftrading")!
        #expect(RobinhoodOAuth.parseCallback(ok, expectedState: "s1", issuer: iss) == .code("abc"))
        if case .failure = RobinhoodOAuth.parseCallback(ok, expectedState: "other", issuer: iss) {} else { Issue.record("state mismatch accepted") }
        let wrongIss = URL(string: "tradeboard://robinhood-callback?code=abc&state=s1&iss=https://evil.example")!
        if case .failure = RobinhoodOAuth.parseCallback(wrongIss, expectedState: "s1", issuer: iss) {} else { Issue.record("wrong issuer accepted") }
        let denied = URL(string: "tradeboard://robinhood-callback?error=access_denied&error_description=User+declined&state=s1")!
        #expect(RobinhoodOAuth.parseCallback(denied, expectedState: "s1", issuer: iss) == .failure("access_denied: User declined"))
    }

    @Test func tokensParseAndKeepOldRefresh() throws {
        let now = Date(timeIntervalSince1970: 1000)
        let t = try RobinhoodOAuth.parseTokens(#"{"access_token":"a","expires_in":3600}"#.data(using: .utf8)!, now: now, keepingRefresh: "r0")
        #expect(t.accessToken == "a" && t.refreshToken == "r0" && t.expiresAt == now.addingTimeInterval(3600))
        #expect(throws: RobinhoodError.self) { try RobinhoodOAuth.parseTokens(#"{"error":"invalid_grant"}"#.data(using: .utf8)!) }
    }

    @Test func orderToolsAreRefusedBeforeAnyRequest() async {
        let mcp = RobinhoodMCP(accessToken: "x", url: URL(string: "http://127.0.0.1:9/never")!)
        for name in ["place_equity_order", "cancel_equity_order", "review_equity_order", "place_crypto_order", "update_alert"] {
            await #expect(throws: ToolCallFailed.self) { _ = try await mcp.call(name) }
        }
        #expect(!RobinhoodMCP.readOnlyTools.contains { $0.contains("order") || $0.hasPrefix("place") || $0.hasPrefix("cancel") })
    }

    @Test func repliesParseFromJSONAndEventStream() throws {
        let sse = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"method\":\"notifications/progress\"}\n\nevent: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":3,\"result\":{\"ok\":true}}\n\n"
        let r = try RobinhoodMCP.parseReply(sse.data(using: .utf8)!, contentType: "text/event-stream", id: 3)
        #expect((r["result"] as? [String: Any])?["ok"] as? Bool == true)
        let j = try RobinhoodMCP.parseReply(#"{"jsonrpc":"2.0","id":1,"result":{}}"#.data(using: .utf8)!, contentType: "application/json", id: 1)
        #expect(j["id"] as? Int == 1)
    }

    @Test func toolValueUsesStructuredContentThenText() throws {
        let s = try RobinhoodMCP.toolValue(["result": ["structuredContent": ["data": [1]], "content": []]], name: "t")
        #expect((s as? [String: Any])?["data"] != nil)
        let t = try RobinhoodMCP.toolValue(["result": ["content": [["type": "text", "text": "{\"a\":1}"]]]], name: "t")
        #expect((t as? [String: Any])?["a"] as? Int == 1)
        #expect(throws: ToolCallFailed.self) { try RobinhoodMCP.toolValue(["result": ["isError": true, "content": [["type": "text", "text": "nope"]]]], name: "t") }
    }

    @Test func parsesAccountsMaskedApprovalsAndQuote() throws {
        let acc: [String: Any] = ["data": ["results": [["account_number": "5QR12345678", "agentic_allowed": true], ["account_number": "999", "agentic_allowed": false]]], "guide": "…"]
        let rows = RobinhoodParse.accounts(acc)
        #expect(rows.map(\.masked) == ["••••5678", "••••999"])
        #expect(rows.first?.agenticAllowed == true)
        #expect(RobinhoodParse.approvals(["data": ["trade_approvals_enabled": false]]) == "off")
        #expect(RobinhoodParse.approvals(["data": ["setting": "ENABLED"]]) == "on")
        #expect(RobinhoodParse.approvals(["data": [:] as [String: Any]]) == "unknown")
        let q: [String: Any] = ["data": ["results": [["quote": ["symbol": "SPY", "last_trade_price": "600.10", "venue_last_trade_time": "2026-11-17T20:59:59Z", "last_non_reg_trade_price": "601.00", "venue_last_non_reg_trade_time": "2026-11-17T23:00:00Z", "state": "active"]]]]]
        #expect(try RobinhoodParse.quotePrice(q, symbol: "SPY") == 601.0)
        #expect(throws: RobinhoodError.self) { try RobinhoodParse.quotePrice(q, symbol: "AAPL") }
    }

    @Test func agentIdRuleMatchesTheBoard() {
        #expect(isValidAgentId("claude"))
        #expect(isValidAgentId("gemini-2_x"))
        #expect(!isValidAgentId("Claude"))
        #expect(!isValidAgentId("c"))
        #expect(!isValidAgentId("1abc"))
    }
}
