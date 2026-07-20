import ContempoCore
import XCTest

final class RiskFlagsTests: XCTestCase {
    func testHasWarningWhenVagueOrBackfilled() {
        let clean = RiskFlags(isVague: false, isBackfilled: false, daysLate: 0, reasons: [])
        XCTAssertFalse(clean.hasWarning)

        let vague = RiskFlags(isVague: true, isBackfilled: false, daysLate: 0, reasons: ["Vague description"])
        XCTAssertTrue(vague.hasWarning)

        let backfilled = RiskFlags(isVague: false, isBackfilled: true, daysLate: 5, reasons: ["Logged late"])
        XCTAssertTrue(backfilled.hasWarning)

        let both = RiskFlags(isVague: true, isBackfilled: true, daysLate: 10, reasons: ["Vague", "Late"])
        XCTAssertTrue(both.hasWarning)
    }

    func testMaterialParticipationTestConstants() {
        XCTAssertEqual(MaterialParticipationTest.thresholdHours, 100)
        XCTAssertEqual(MaterialParticipationTest.name, "STR")
    }
}
