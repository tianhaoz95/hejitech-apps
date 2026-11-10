import XCTest
@testable import TradeboardKit

/// Supabase sign-in requests: the token endpoint with its grant in the query (not encoded into the path).
final class SignInRequestsTests: XCTestCase {
    private func backend() -> TradeboardBackend {
        let conf = URLSessionConfiguration.ephemeral
        conf.protocolClasses = [StubProtocol.self]
        StubProtocol.requests = []
        return TradeboardBackend(config: .production, sessionCookie: nil, http: URLSession(configuration: conf))
    }

    private let sessionReply = Data(#"{"access_token":"a","refresh_token":"r","expires_in":3600,"user":{"id":"u1","email":"me@example.com"}}"#.utf8)

    func testGoogleCodeExchangeHitsTheTokenEndpointWithItsQuery() async throws {
        let b = backend()
        StubProtocol.reply = (200, ["Content-Type": "application/json"], sessionReply)
        let s = try await b.exchangeCode("code-1", verifier: "ver-1")
        let r = try XCTUnwrap(StubProtocol.requests.first)
        XCTAssertEqual(r.url?.path, "/auth/v1/token")
        XCTAssertEqual(r.url?.query, "grant_type=pkce")
        XCTAssertEqual(r.url?.host, "jitdzllkxfhlrxxvljhp.supabase.co")
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(r.httpBody)) as? [String: String])
        XCTAssertEqual(body, ["auth_code": "code-1", "code_verifier": "ver-1"])
        XCTAssertEqual(s.userId, "u1")
    }

    func testAppleSignInUsesTheIdTokenGrant() async throws {
        let b = backend()
        StubProtocol.reply = (200, ["Content-Type": "application/json"], sessionReply)
        _ = try await b.signInWithApple(idToken: "jwt")
        let r = try XCTUnwrap(StubProtocol.requests.first)
        XCTAssertEqual(r.url?.path, "/auth/v1/token")
        XCTAssertEqual(r.url?.query, "grant_type=id_token")
    }
}
