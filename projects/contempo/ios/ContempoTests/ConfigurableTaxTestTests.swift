@testable import Contempo
import ContempoCore
import XCTest

@MainActor
final class ConfigurableTaxTestTests: XCTestCase {
    func testStatutoryTaxTestProperties() {
        XCTAssertEqual(StatutoryTaxTest.hundredHours.thresholdHours, 100)
        XCTAssertEqual(StatutoryTaxTest.hundredHours.legalCitation, "Treas. Reg. §1.469-5T(a)(3)")

        XCTAssertEqual(StatutoryTaxTest.fiveHundredHours.thresholdHours, 500)
        XCTAssertEqual(StatutoryTaxTest.fiveHundredHours.legalCitation, "Treas. Reg. §1.469-5T(a)(1)")

        XCTAssertEqual(StatutoryTaxTest.realEstateProfessional.thresholdHours, 750)
        XCTAssertEqual(StatutoryTaxTest.realEstateProfessional.legalCitation, "IRC §469(c)(7)")
    }

    func testTaxTestStorePersistence() {
        let suite = "test.tax.strategy.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }

        let store = TaxTestStore(defaults: defaults)
        XCTAssertEqual(store.selectedTest, .hundredHours)

        store.setTest(.fiveHundredHours)
        XCTAssertEqual(store.selectedTest, .fiveHundredHours)

        let reloadedStore = TaxTestStore(defaults: defaults)
        XCTAssertEqual(reloadedStore.selectedTest, .fiveHundredHours)

        store.setTest(.realEstateProfessional)
        XCTAssertEqual(store.selectedTest.thresholdHours, 750)
    }
}
