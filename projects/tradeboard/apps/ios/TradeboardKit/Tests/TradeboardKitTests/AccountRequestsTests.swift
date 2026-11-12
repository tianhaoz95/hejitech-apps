import XCTest
@testable import TradeboardKit

/// Captures requests and answers them, so the client's wire format is checked without a server.
final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var requests: [URLRequest] = []
    nonisolated(unsafe) static var reply: (Int, [String: String], Data) = (200, [:], Data("{}".utf8))

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var r = request
        if r.httpBody == nil, let s = r.httpBodyStream {
            s.open(); defer { s.close() }
            var d = Data(); var buf = [UInt8](repeating: 0, count: 4096)
            while s.hasBytesAvailable { let n = s.read(&buf, maxLength: buf.count); if n <= 0 { break }; d.append(buf, count: n) }
            r.httpBody = d
        }
        Self.requests.append(r)
        let (code, headers, body) = Self.reply
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: headers)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class AccountRequestsTests: XCTestCase {
    private func backend(cookie: String? = nil) -> TradeboardBackend {
        let conf = URLSessionConfiguration.ephemeral
        conf.protocolClasses = [StubProtocol.self]
        StubProtocol.requests = []
        return TradeboardBackend(config: .production, sessionCookie: cookie, http: URLSession(configuration: conf))
    }

    func testDeleteAccountSendsConfirmedDeleteWithSessionAndSignsOut() async throws {
        let b = backend(cookie: "abc")
        StubProtocol.reply = (200, ["Content-Type": "application/json"], Data(#"{"ok":true,"plans_deleted":3}"#.utf8))
        try await b.deleteAccount()
        let r = try XCTUnwrap(StubProtocol.requests.first)
        XCTAssertEqual(r.httpMethod, "DELETE")
        XCTAssertEqual(r.url?.absoluteString, "https://tradeboard.hejitech.workers.dev/api/account?confirm=1")
        XCTAssertEqual(r.value(forHTTPHeaderField: "X-Tradeboard"), "1")
        XCTAssertEqual(r.value(forHTTPHeaderField: "Cookie"), "__Host-tb_session=abc")
        XCTAssertNil(b.sessionCookie, "deleting signs out")
    }

    func testDeleteAccountFailureKeepsTheSession() async {
        let b = backend(cookie: "abc")
        StubProtocol.reply = (500, [:], Data(#"{"error_code":"internal"}"#.utf8))
        do { try await b.deleteAccount(); XCTFail("should throw") } catch {}
        XCTAssertEqual(b.sessionCookie, "abc")
    }

    func testReviewSignInPostsCredentialsAndKeepsTheCookie() async throws {
        let b = backend()
        StubProtocol.reply = (200, ["Set-Cookie": "__Host-tb_session=xyz; Path=/; HttpOnly; Secure", "Content-Type": "application/json"], Data(#"{"ok":true,"signed_in":true}"#.utf8))
        try await b.reviewSignIn(email: "a@b.c", password: "pw")
        let r = try XCTUnwrap(StubProtocol.requests.first)
        XCTAssertEqual(r.httpMethod, "POST")
        XCTAssertEqual(r.url?.path, "/api/review-sign-in")
        XCTAssertEqual(r.value(forHTTPHeaderField: "X-Tradeboard"), "1")
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(r.httpBody)) as? [String: String])
        XCTAssertEqual(body, ["email": "a@b.c", "password": "pw"])
        XCTAssertEqual(b.sessionCookie, "xyz")
    }

    func testReviewSignInWrongPasswordIs401() async {
        let b = backend()
        StubProtocol.reply = (401, [:], Data(#"{"error_code":"wrong_password"}"#.utf8))
        do {
            try await b.reviewSignIn(email: "a@b.c", password: "nope")
            XCTFail("should throw")
        } catch let e as BackendError {
            guard case .http(401, _) = e else { return XCTFail("\(e)") }
        } catch { XCTFail("\(error)") }
        XCTAssertNil(b.sessionCookie)
    }

    func testExtractSessionCookieIgnoresUnrelatedCookiesAndDecodesValue() throws {
        let resp = try XCTUnwrap(HTTPURLResponse(
            url: BackendConfig.production.site,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Set-Cookie": "__cf_bm=ignored; Path=/; HttpOnly, __Host-tb_session=tok%2B123; Path=/; HttpOnly; SameSite=Strict; Secure"]
        ))
        XCTAssertEqual(TradeboardBackend.extractSessionCookie(from: resp), "tok+123")
    }

    func testSessionStorePersistsAndClearsPerEnvironment() {
        let testConfig = BackendConfig(
            site: URL(string: "https://test-unit.tradeboard.local")!,
            supabaseURL: BackendConfig.local.supabaseURL,
            anonKey: BackendConfig.local.anonKey
        )
        defer { SessionStore.clear(for: testConfig) }

        SessionStore.clear(for: testConfig)
        XCTAssertNil(SessionStore.load(for: testConfig))

        let saved = SavedSession(cookie: "cookie-abc", email: "owner@example.com")
        SessionStore.save(saved, for: testConfig)
        XCTAssertEqual(SessionStore.load(for: testConfig), saved)

        SessionStore.clear(for: testConfig)
        XCTAssertNil(SessionStore.load(for: testConfig))
    }
}

final class PlanViewDecodingTests: XCTestCase {
    /// The plan view's comments have no plan_id and call a question's state `status`; a plan with
    /// comments failed to open in 0.1.0 because the model required plan_id.
    func testPlanWithCommentsAndAnOpenQuestionDecodes() throws {
        let json = #"""
        {"plan_id":"p1","title":"DEMO","status":"debated","is_demo":true,"ticker":"COST","side":"buy",
         "order":{"side":"buy","ticker":"COST","order_type":"limit","stop_price":null,"limit_price":880,"account_scope":"dedicated_mcp_account_only","time_in_force":"day","quantity_shares":2,"quantity_dollars":null},
         "thesis":"t","created_at":"2026-11-10T15:59:04.723Z","updated_at":"2026-11-10T15:59:04.723Z","valid_until":"2026-11-10T21:00:00.000Z","current_version":1,
         "comments":[
          {"comment_id":"c1","version":1,"author_type":"agent","author_id":"gemini","body":"Dissent","anchor":"risks_and_dissent","parent_comment_id":null,"mentioned_agent_id":null,"created_at":"2026-11-10T15:59:04.728Z","is_question":false},
          {"comment_id":"c2","version":1,"author_type":"agent","author_id":"claude","body":"@gemini what entry?","anchor":"general","parent_comment_id":null,"mentioned_agent_id":"gemini","created_at":"2026-11-10T15:59:05.000Z","is_question":true,"status":"open","asked_by":"claude","asked_at":"2026-11-10T15:59:05.000Z","resolved_by":null,"resolved_at":null,"resolution_note":null}
         ]}
        """#
        let plan = try JSONDecoder().decode(PlanDetail.self, from: Data(json.utf8))
        XCTAssertEqual(plan.comments?.count, 2)
        XCTAssertNil(plan.comments?[0].plan_id)
        XCTAssertEqual(plan.comments?[1].is_question, true)
        XCTAssertEqual(plan.comments?[1].question_status, "open")
    }
}
