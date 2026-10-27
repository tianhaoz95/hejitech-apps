import XCTest
@testable import HeadwayKit

final class HeadwayKitTests: XCTestCase {
    func fixture(_ name: String) throws -> Data {
        try Data(contentsOf: Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")!)
    }

    /// The Worker's /api/me/board (captured from the local stack with the seed glasses token).
    func testDecodesMyBoard() throws {
        let b = try Backend.decoder.decode(MyBoard.self, from: fixture("me-board"))
        XCTAssertTrue(b.hasCommute)
        let board = try XCTUnwrap(b.board)
        XCTAssertFalse(board.trains.isEmpty)
        XCTAssertTrue(["morning", "evening"].contains(board.leg))
        XCTAssertEqual(board.trains[0].id, "\(board.trains[0].serviceDate):\(board.trains[0].tripId)")
    }

    func testDecodesStations() throws {
        let s = try Backend.decoder.decode([Station].self, from: fixture("stations"))
        XCTAssertEqual(s.first?.id, "san_francisco")
        XCTAssertTrue(s.contains { $0.id == "mountain_view" && $0.short == "MTN VIEW" })
    }

    /// The Worker's checkSettings expects every key, with null for a missing leg or usual time.
    func testEncodesSettingsWithNulls() throws {
        var s = Settings.defaults
        s.morning = .morning(from: "mountain_view", to: "san_francisco")
        s.morning?.expressPreference = .preferExpress
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: Backend.encoder.encode(s)) as? [String: Any])
        XCTAssertTrue(obj["evening"] is NSNull)
        let m = try XCTUnwrap(obj["morning"] as? [String: Any])
        XCTAssertTrue(m["usual"] is NSNull)
        XCTAssertEqual(m["walk_minutes"] as? Int, 10)
        XCTAssertEqual(m["express_preference"] as? String, "prefer_express")
        XCTAssertEqual((obj["alerts"] as? [String: Any])?["delay_threshold"] as? Int, 5)
        XCTAssertEqual(try Backend.decoder.decode(Settings.self, from: Backend.encoder.encode(s)), s)
    }

    func testExpressPreferenceProperties() {
        XCTAssertEqual(ExpressPreference.all.title, "All trains")
        XCTAssertEqual(ExpressPreference.preferExpress.title, "Prefer express")
        XCTAssertEqual(ExpressPreference.expressOnly.title, "Express only")
        XCTAssertEqual(ExpressPreference.allCases.count, 3)
    }

    func testClock() {
        // 2026-10-27 08:14 PDT = 15:14 UTC
        let t = Date(timeIntervalSince1970: 1_793_114_040).timeIntervalSince1970 * 1000
        XCTAssertEqual(Clock.time(t), "8:14")
        XCTAssertEqual(Clock.until(t, now: Date(timeIntervalSince1970: t / 1000 - 12 * 60)), "12m")
        XCTAssertEqual(Clock.until(t, now: Date(timeIntervalSince1970: t / 1000 + 5)), "now")
        XCTAssertEqual(Clock.minutes("08:05"), 485)
        XCTAssertNil(Clock.minutes("25:00"))
        XCTAssertEqual(Clock.hhmm(485), "08:05")
    }

    func testOAuthStartUsesPKCE() {
        let (url, verifier) = Backend(config: .production).oauthStart(provider: "google", redirect: "headway://login-callback")
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!
        XCTAssertEqual(items.first { $0.name == "provider" }?.value, "google")
        XCTAssertEqual(items.first { $0.name == "code_challenge_method" }?.value, "s256")
        XCTAssertGreaterThan(verifier.count, 40)
    }

    func testErrorMessagesComeFromTheWorker() {
        XCTAssertEqual(BackendError.http(400, #"{"error":"that code is wrong"}"#).errorDescription, "that code is wrong")
    }
}
