import XCTest
@testable import LogCore

/// The watch's tilt mode: which tilts lock a direction, and what a direction can hold.
final class TiltCompassTests: XCTestCase {
    private let t0 = Date(timeIntervalSince1970: 1_000_000)

    /// Feeds `(x, y, rotation)` readings at 30 Hz and returns the first direction that locked.
    private func run(_ lock: inout TiltLock, seconds: Double, _ reading: (Double) -> (Double, Double, Double)) -> TiltCompass.Direction? {
        for i in 0..<Int(seconds * 30) {
            let t = Double(i) / 30
            let (x, y, r) = reading(t)
            if let d = lock.update(x: x, y: y, rotation: r, at: t0.addingTimeInterval(t)) { return d }
        }
        return nil
    }

    func testAHeldTiltLocksAfterTheDwell() {
        var lock = TiltLock()
        XCTAssertNil(run(&lock, seconds: 0.9) { _ in (0, 25, 0.1) })
        lock = TiltLock()
        XCTAssertEqual(run(&lock, seconds: 1.2) { _ in (0, 25, 0.1) }, .north)
        lock = TiltLock()
        XCTAssertEqual(run(&lock, seconds: 1.2) { _ in (-30, 5, 0.1) }, .west)
        XCTAssertEqual(lock.phase, .locked(.west))
    }

    func testSmallTiltsAndStillnessDoNothing() {
        var lock = TiltLock()
        XCTAssertNil(run(&lock, seconds: 5) { _ in (4, -6, 0.05) })
        XCTAssertEqual(lock.phase, .idle)
    }

    func testRockingNeverLocks() {
        // rocking a baby at 0.8 Hz swings the wrist ±25° with a fast-turning wrist
        var lock = TiltLock()
        XCTAssertNil(run(&lock, seconds: 10) { t in (0, 25 * sin(2 * .pi * 0.8 * t), 2.5 * abs(cos(2 * .pi * 0.8 * t)) + 0.6) })
    }

    func testAMovingWristRestartsTheDwell() {
        var lock = TiltLock()
        // tilted the whole time, but still turning for the first 0.6 s: locks at 1.6 s, not 1 s
        var locked: Double?
        for i in 0..<60 {
            let t = Double(i) / 30
            if lock.update(x: 30, y: 0, rotation: t < 0.6 ? 1.5 : 0.2, at: t0.addingTimeInterval(t)) != nil { locked = t; break }
        }
        XCTAssertEqual(try XCTUnwrap(locked), 1.6, accuracy: 0.05)
    }

    func testTheEdgeDoesNotFlicker() {
        var lock = TiltLock()
        _ = lock.update(x: 0, y: 20, rotation: 0, at: t0)          // in: past `enter`
        XCTAssertEqual(lock.direction(x: 0, y: 14), .north)          // between exit and enter: stays
        XCTAssertNil(lock.direction(x: 0, y: 10))                    // under exit: out
        XCTAssertEqual(lock.direction(x: 22, y: 14), .east)          // clearly another direction
    }

    func testEmptyDirectionsAreIgnored() {
        var lock = TiltLock(available: [.north, .east, .south])
        XCTAssertNil(run(&lock, seconds: 2) { _ in (-30, 0, 0) })
    }

    func testChoicesSkipTypesThatNeedTyping() {
        let all = TiltCompass.choices(enabled: Set(EventRegistry.shared.categories.map(\.id)))
        XCTAssertEqual(Array(all.prefix(3)), ["feed", "diaper", "sleep"])
        XCTAssertTrue(all.contains("tummy_time"))
        XCTAssertFalse(all.contains("medication"))    // needs the medicine's name
        XCTAssertFalse(all.contains("weight"))        // growth isn't a care type
        XCTAssertEqual(TiltCompass.choices(enabled: ["diaper", "sleep"]), ["diaper", "sleep"])
        XCTAssertEqual(TiltCompass.defaultAssignment(.west, choices: all), all[3])
        XCTAssertEqual(TiltCompass.defaultAssignment(.west, choices: ["feed", "diaper", "sleep"]), "")
    }

    func testSlotRoundTripsThroughTheApplicationContext() {
        let slot = TiltCompass.Slot(direction: .west, action: "care", type: "tummy_time", label: "Tummy time", icon: "figure.play")
        XCTAssertEqual(TiltCompass.Slot(context: slot.context), slot)
        XCTAssertEqual(TiltCompass.Slot(direction: .north, action: "feed", label: "Feed", icon: "drop.fill").type, "feed")
    }

    func testATiltDiaperWaitsForItsKind() async throws {
        var h = Household(id: H, babyId: B, bottleMl: 120, caregivers: [Caregiver(id: A, name: "Alex")])
        h.categories = EventRegistry.shared.categories.map(\.id)
        let s = LogService(store: try SQLiteLogStore.inMemory(), household: h, me: A, interpreter: VoiceInterpreter(model: KeywordDecisionModel()))
        let gesture = Provenance(surface: .watch, input: .gesture)
        do {
            _ = try await s.log(type: "diaper", provenance: gesture)
            XCTFail("a diaper without a kind needs the flag")
        } catch {}
        let e = try await s.log(type: "diaper", fields: [LogEvent.needsDetails: .bool(true)], provenance: gesture)
        XCTAssertTrue(e.needsDetails)
        try await s.edit(e.id, fields: ["kind": .string("dirty")])
        let log = try await s.derived()
        let answered = try XCTUnwrap(log.effective.first { $0.type == "diaper" })
        XCTAssertFalse(answered.needsDetails)
        XCTAssertEqual(answered.fields["kind"], .string("dirty"))
    }
}
