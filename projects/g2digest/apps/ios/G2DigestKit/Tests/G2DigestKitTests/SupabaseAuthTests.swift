import Foundation
import XCTest
@testable import G2DigestKit

final class SupabaseAuthTests: XCTestCase {
    func testParsesATokenResponse() throws {
        let body = #"{"access_token":"a.b.c","token_type":"bearer","expires_in":3600,"refresh_token":"r1","user":{"id":"u-1","email":"me@example.com"}}"#
        let now = Date(timeIntervalSince1970: 1_000)
        let s = try SupabaseAuth.parseSession(Data(body.utf8), now: now)
        XCTAssertEqual(s.accessToken, "a.b.c")
        XCTAssertEqual(s.refreshToken, "r1")
        XCTAssertEqual(s.userId, "u-1")
        XCTAssertEqual(s.email, "me@example.com")
        XCTAssertEqual(s.expiresAt, now.addingTimeInterval(3600))
    }

    func testRefusesAReplyWithoutASession() {
        XCTAssertThrowsError(try SupabaseAuth.parseSession(Data(#"{"error":"invalid_grant"}"#.utf8)))
    }

    func testPicksTheAuthProjectForTheServer() {
        XCTAssertEqual(AuthConfig.forServer(URL(string: "http://127.0.0.1:8790")!), .local)
        XCTAssertEqual(AuthConfig.forServer(URL(string: "https://g2digest.hejitech.workers.dev")!), .production)
    }

    func testGoogleStartsAPKCEFlowBackToTheApp() {
        let auth = SupabaseAuth(config: .production)
        let (url, verifier) = auth.oauthStart(provider: "google", redirect: "g2digest://login-callback")
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!
        func q(_ n: String) -> String? { items.first { $0.name == n }?.value }
        XCTAssertEqual(url.path, "/auth/v1/authorize")
        XCTAssertEqual(q("provider"), "google")
        XCTAssertEqual(q("redirect_to"), "g2digest://login-callback")
        XCTAssertEqual(q("code_challenge_method"), "s256")
        XCTAssertGreaterThanOrEqual(verifier.count, 43)
        XCTAssertNotEqual(q("code_challenge"), verifier)
    }
}
