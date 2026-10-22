@testable import Contempo
import XCTest

final class ArrivalDetectorTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_800_000_000)

    func testFiresOnceAfterFiveMinutesStopped() {
        var d = ArrivalDetector()
        XCTAssertNil(d.observe(speed: 0.2, at: t0))
        XCTAssertNil(d.observe(speed: 0.0, at: t0.addingTimeInterval(299)))
        XCTAssertEqual(d.observe(speed: 0.0, at: t0.addingTimeInterval(300)), .arrived)
        XCTAssertNil(d.observe(speed: 0.0, at: t0.addingTimeInterval(600)))
    }

    func testUsesTheFixTimesNotTheClock() {
        var d = ArrivalDetector()
        // Two fixes delivered together but taken five minutes apart still count as a stop.
        XCTAssertNil(d.observe(speed: 0.5, at: t0))
        XCTAssertEqual(d.observe(speed: 0.5, at: t0.addingTimeInterval(301)), .arrived)
    }

    func testStopAndGoTrafficDoesNotFire() {
        var d = ArrivalDetector()
        var t = t0
        for _ in 0..<10 { // 2 minutes stopped, then moving, repeatedly
            XCTAssertNil(d.observe(speed: 0.0, at: t))
            XCTAssertNil(d.observe(speed: 0.0, at: t.addingTimeInterval(120)))
            XCTAssertNil(d.observe(speed: 8.0, at: t.addingTimeInterval(130)))
            t = t.addingTimeInterval(200)
        }
    }

    func testDrivingAwayRearmsIt() {
        var d = ArrivalDetector()
        _ = d.observe(speed: 0, at: t0)
        XCTAssertEqual(d.observe(speed: 0, at: t0.addingTimeInterval(300)), .arrived)
        XCTAssertEqual(d.observe(speed: 10, at: t0.addingTimeInterval(400)), .moving)
        _ = d.observe(speed: 0, at: t0.addingTimeInterval(500))
        XCTAssertEqual(d.observe(speed: 0, at: t0.addingTimeInterval(800)), .arrived)
    }

    func testUnknownSpeedIsIgnored() {
        var d = ArrivalDetector()
        _ = d.observe(speed: 0, at: t0)
        XCTAssertNil(d.observe(speed: -1, at: t0.addingTimeInterval(400)))
        XCTAssertEqual(d.observe(speed: 0, at: t0.addingTimeInterval(401)), .arrived)
    }
}
