import Foundation
import XCTest
@testable import LogCore

final class SessionExpiryTests: XCTestCase {
    func testDeadSessionAnswers() {
        let notFound = #"{"code":400,"error_code":"refresh_token_not_found","msg":"Invalid Refresh Token: Refresh Token Not Found"}"#
        XCTAssertTrue(SupabaseClient.isDeadSession(400, notFound))
        XCTAssertTrue(SupabaseClient.isDeadSession(400, #"{"error_code":"refresh_token_already_used"}"#))
        XCTAssertTrue(SupabaseClient.isDeadSession(403, #"{"error_code":"session_not_found"}"#))
    }

    func testTransientFailuresKeepTheSession() {
        XCTAssertFalse(SupabaseClient.isDeadSession(500, "refresh_token_not_found"))
        XCTAssertFalse(SupabaseClient.isDeadSession(429, #"{"error_code":"over_request_rate_limit"}"#))
        XCTAssertFalse(SupabaseClient.isDeadSession(400, #"{"error_code":"validation_failed"}"#))
    }

    /// A refused refresh drops the session, reports it once and throws `sessionExpired`.
    func testRefusedRefreshDropsTheSession() async throws {
        StubProtocol.response = (400, #"{"code":400,"error_code":"refresh_token_not_found","msg":"Invalid Refresh Token: Refresh Token Not Found"}"#)
        let conf = URLSessionConfiguration.ephemeral
        conf.protocolClasses = [StubProtocol.self]
        let expired = AuthSession(accessToken: "a", refreshToken: "r", userId: UUID(), email: nil, expiresAt: Date().addingTimeInterval(-10))
        let client = SupabaseClient(config: .local, session: expired, http: URLSession(configuration: conf))
        var reported = 0
        client.onSessionExpired = { reported += 1 }
        let results = await withTaskGroup(of: Error?.self) { group in
            for _ in 0..<2 { group.addTask { do { try await client.refreshIfNeeded(); return nil } catch { return error } } }
            return await group.reduce(into: [Error?]()) { $0.append($1) }
        }
        for e in results {
            guard case BackendError.sessionExpired? = e else { return XCTFail("\(String(describing: e))") }
        }
        XCTAssertNil(client.session)
        XCTAssertEqual(reported, 1)
        XCTAssertEqual(StubProtocol.requests, 1, "parallel callers share one refresh")
    }
}

final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var response: (Int, String) = (200, "{}")
    nonisolated(unsafe) static var requests = 0
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests += 1
        let (code, body) = Self.response
        let resp = HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
