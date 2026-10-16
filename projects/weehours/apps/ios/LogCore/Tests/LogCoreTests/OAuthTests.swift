import CryptoKit
import XCTest
@testable import LogCore

final class OAuthTests: XCTestCase {
    func testGoogleAuthorizeURLCarriesAPKCEChallenge() throws {
        let client = SupabaseClient(config: .local)
        let (url, verifier) = client.oauthStart(provider: "google", redirect: "weehours://login-callback")
        let c = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        let q = Dictionary(uniqueKeysWithValues: (c.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        XCTAssertEqual(c.path, "/auth/v1/authorize")
        XCTAssertEqual(q["provider"], "google")
        XCTAssertEqual(q["redirect_to"], "weehours://login-callback")
        XCTAssertEqual(q["code_challenge_method"], "s256")
        XCTAssertEqual(q["code_challenge"], Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded)
        XCTAssertGreaterThanOrEqual(verifier.count, 43, "RFC 7636 minimum")
        XCTAssertNil(verifier.rangeOfCharacter(from: CharacterSet(charactersIn: "+/=")))
        XCTAssertNotEqual(verifier, client.oauthStart(provider: "google", redirect: "x").verifier)
    }
}
