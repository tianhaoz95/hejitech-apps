import XCTest
@testable import HeadwayKit

final class SiriSpeechTests: XCTestCase {
    func board() throws -> Board {
        let data = try Data(contentsOf: Bundle.module.url(forResource: "board-weather", withExtension: "json", subdirectory: "Fixtures")!)
        return try Backend.decoder.decode(Board.self, from: data)
    }

    func testNextTrainsSaysTheFirstTwoAndThatTimesAreTheTimetables() throws {
        var b = try board()
        let first = b.trains[0]
        let now = first.predDep - 10 * 60_000
        let s = SiriSpeech.nextTrains(b, now: now)
        XCTAssertTrue(s.hasPrefix("The next train from Mountain View to San Francisco is the \(Clock.time(first.predDep)) Local, arriving at \(Clock.time(first.predArr))."), s)
        XCTAssertTrue(s.contains("After that, the \(Clock.time(b.trains[1].predDep)) Local."), s)
        XCTAssertTrue(s.hasSuffix("These are timetable times."), s)

        // Late, and a hurry: said; a cancelled train is skipped.
        b.live = true
        b.trains[0].status = .cancelled
        b.trains[1].status = .late
        b.trains[1].delayMin = 4
        b.trains[1].catchState = "run"
        let t = SiriSpeech.nextTrains(b, now: now)
        XCTAssertTrue(t.contains("is the \(Clock.time(b.trains[1].predDep)) Local, 4 minutes late,"), t)
        XCTAssertTrue(t.contains("You'll need to hurry."), t)
        XCTAssertFalse(t.contains("timetable"), t)
    }

    func testNoMoreTrains() throws {
        let b = try board()
        XCTAssertEqual(SiriSpeech.nextTrains(b, now: b.trains.last!.predDep + 3_600_000), "No more trains from Mountain View to San Francisco today.")
    }

    func testTrackedTrain() {
        let stop = NextStop(id: "palo_alto", name: "Palo Alto", short: "PALO ALTO", pred: 1_794_767_000_000)
        var p = TrainProgress(tripId: "t", train: "609", kind: "LOC", serviceDate: "20261116", to: StationRef(id: "san_francisco", name: "San Francisco", short: "SF"),
                              next: stop, predArr: 1_794_768_000_000, arr: 1_794_767_820_000, delayMin: 3, stopsLeft: 6, cancelled: false, arrived: false, departed: true, live: true)
        let t = { TrackedWithProgress(tripId: "t", serviceDate: "20261116", from: "mountain_view", to: "san_francisco", progress: p) }
        XCTAssertEqual(SiriSpeech.tracked(t(), fromName: "Mountain View"), "Train 609 is heading to Palo Alto, arriving at San Francisco at \(Clock.time(p.predArr)), 3 minutes late, with 6 stops to go.")
        p.departed = false
        XCTAssertEqual(SiriSpeech.tracked(t(), fromName: "Mountain View"), "Train 609 hasn't left Mountain View yet. It gets to San Francisco at \(Clock.time(p.predArr)), 3 minutes late.")
        p.arrived = true
        XCTAssertEqual(SiriSpeech.tracked(t(), fromName: nil), "Train 609 has arrived at San Francisco.")
    }
}
