import XCTest
@testable import LogCore

/// A child not born yet: due date, gestational age, which entries they take, and the movement types.
final class PregnancyTests: XCTestCase {
    private let tap = Provenance(surface: .phone, input: .tap)
    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date { cal.date(from: DateComponents(year: y, month: m, day: d))! }

    func testGestationCountsBackFromTheDueDate() {
        let due = day(2027, 2, 10)
        let baby = Baby(name: "Bean", dueDate: due)
        XCTAssertTrue(baby.isExpected)
        XCTAssertEqual(baby.gestation(now: due, calendar: cal)!.weeks, 40)
        let g = baby.gestation(now: cal.date(byAdding: .day, value: -(11 * 7 + 4), to: due)!, calendar: cal)!
        XCTAssertEqual(g.weeks, 28)   // 40w - 11w4d = 28w3d
        XCTAssertEqual(g.days, 3)
        XCTAssertNil(Baby(name: "Mia", birthDate: due).gestation(now: due, calendar: cal))
    }

    func testBornChildrenAndExpectedOnesTakeDifferentEntries() {
        let expected = Baby(name: "Bean", dueDate: day(2027, 2, 10))
        let born = Baby(name: "Mia", birthDate: day(2026, 1, 2))
        XCTAssertTrue(expected.canLog(category: "movement"))
        XCTAssertFalse(expected.canLog(category: "bottle"))
        XCTAssertFalse(born.canLog(category: "movement"))
        XCTAssertTrue(born.canLog(category: "diaper"))
        // a due date left over after birth doesn't make a child expected
        XCTAssertFalse(Baby(name: "Leo", birthDate: day(2026, 3, 1), dueDate: day(2026, 3, 4)).isExpected)
    }

    func testDueDateRoundTripsWithTheChild() throws {
        let baby = Baby(name: "Bean", dueDate: day(2027, 2, 10))
        let data = try LogCoding.encoder.encode(baby)
        let back = try LogCoding.decoder.decode(Baby.self, from: data)
        XCTAssertEqual(back.dueDate.map { cal.startOfDay(for: $0) }, day(2027, 2, 10))
        XCTAssertNil(back.birthDate)
        // the backend returns it as a plain date in the child's settings
        let json = #"{"id":"\#(B.uuidString)","name":"Bean","birth_date":null,"due_date":"2027-02-10","position":0}"#
        let decoded = try LogCoding.decoder.decode(Baby.self, from: Data(json.utf8))
        XCTAssertTrue(decoded.isExpected)
    }

    func testMovementsAndKickCountsAreLoggedAndValidated() async throws {
        var h = Household(id: H, babyId: B, bottleMl: 120, caregivers: [Caregiver(id: A, name: "Alex")])
        h.categories = h.categories + ["movement"]
        let s = LogService(store: try SQLiteLogStore.inMemory(), household: h, me: A,
                           interpreter: VoiceInterpreter(model: KeywordDecisionModel()))
        _ = try await s.log(type: "movement", provenance: tap)
        _ = try await s.log(type: "kick_count", fields: ["count": .number(10), "minutes": .number(34)], provenance: tap)
        // a kick count needs its number of movements
        do {
            _ = try await s.log(type: "kick_count", fields: ["minutes": .number(34)], provenance: tap)
            XCTFail("a kick count without a count was logged")
        } catch {}
        let status = StatusSnapshot(log: try await s.derived(), now: Date())
        XCTAssertEqual(status.lastKickCount, 10)
        XCTAssertEqual(status.lastKickMinutes, 34)
        XCTAssertEqual(status.line(now: Date()), "Moved just now · last count 10 in 34m")
    }
}
