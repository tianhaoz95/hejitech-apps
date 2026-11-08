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

    func testDecodesTravelEstimateAndSpareMinutes() throws {
        // Made by @headway/core's board() from a location ~1.6 km from Mountain View, driving.
        let b = try XCTUnwrap(try Backend.decoder.decode(MyBoard.self, from: fixture("me-board-travel")).board)
        let travel = try XCTUnwrap(b.travel)
        XCTAssertEqual(travel.mode, .drive)
        XCTAssertGreaterThan(travel.distanceM, 1000)
        XCTAssertEqual(b.walkMinutes, travel.minutes)
        XCTAssertNotNil(b.trains.first?.bufferMin)
    }

    func testLegKeepsTravelMode() throws {
        var leg = Leg.morning(from: "mountain_view", to: "san_francisco")
        XCTAssertEqual(leg.travelMode, .walk)
        leg.travelMode = .drive
        let json = String(data: try JSONEncoder().encode(leg), encoding: .utf8)!
        XCTAssertTrue(json.contains("\"travel_mode\":\"drive\""))
        XCTAssertEqual(try JSONDecoder().decode(Leg.self, from: Data(json.utf8)).travelMode, .drive)
    }

    func testDecodesEveryTravelModeAndToleratesUnknownOnes() throws {
        for mode in TravelMode.allCases {
            XCTAssertEqual(try JSONDecoder().decode(TravelMode.self, from: Data("\"\(mode.rawValue)\"".utf8)), mode)
        }
        XCTAssertEqual(TravelMode.allCases.map(\.rawValue), ["walk", "bike", "ebike", "scooter", "drive"])
        XCTAssertEqual(try JSONDecoder().decode(TravelMode.self, from: Data("\"hoverboard\"".utf8)), .walk)
        let estimate = try JSONDecoder().decode(TravelEstimate.self, from: Data(#"{"mode":"ebike","distance_m":1600,"minutes":9}"#.utf8))
        XCTAssertEqual(estimate.mode, .ebike)
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

    func testOldSettingsGetDefaultsForNewChoices() throws {
        let json = #"{"morning":null,"evening":null,"switch_at":"12:00","days":[0],"alerts":{"delay":true,"delay_threshold":5,"cancellation":true,"service":true,"leave_now":true,"arrival":true,"arrival_minutes":5}}"#
        let s = try JSONDecoder().decode(Settings.self, from: Data(json.utf8))
        XCTAssertEqual(s.onTrain, .card)
        XCTAssertEqual(s.alerts.scope, .priority)
    }

    func testNewChoicesSurviveARoundTrip() throws {
        var s = Settings.defaults
        s.onTrain = .background
        s.alerts.scope = .all
        let back = try JSONDecoder().decode(Settings.self, from: JSONEncoder().encode(s))
        XCTAssertEqual(back.onTrain, .background)
        XCTAssertEqual(back.alerts.scope, .all)
    }

    func testAPastDueTrainSaysSo() {
        let t = BoardTrain(train: "513", dep: 1_000_000, arr: 2_000_000, predDep: 1_000_000, predArr: 2_000_000, pastDue: true)
        XCTAssertEqual(t.dueLabel(now: Date(timeIntervalSince1970: 1_060)), "Due")
        XCTAssertEqual(t.dueLabel(now: Date(timeIntervalSince1970: 1_200)), "May have left")
    }

    func testBoardDecodesTheOnTrainCard() throws {
        let json = #"{"board":null,"has_commute":true,"saved":true,"tracked":null,"on_train":{"trip_id":"t","service_date":"20261106","confidence":"high","train":"513","kind":"EXP","dir":"N","from":{"id":"a","name":"A","short":"A"},"to":{"id":"b","name":"B","short":"B"},"to_source":"commute","next":{"id":"b","name":"B","short":"B","pred":5},"pred_arr":5,"arr":5,"delay_min":null,"stops_left":1,"stops":[{"id":"b","name":"B","short":"B","pred":5,"status":"now"}],"alerts":[],"tracked":false,"live":true}}"#
        let b = try JSONDecoder().decode(MyBoard.self, from: Data(json.utf8))
        XCTAssertEqual(b.onTrain?.train, "513")
        XCTAssertTrue(b.onTrain?.isSure == true)
    }
}
