@testable import Contempo
import ContempoCore
import ContempoFirestore
import XCTest

@MainActor
final class DashboardViewModelTests: XCTestCase {
    func testDashboardInitialState() {
        let viewModel = DashboardViewModel()
        XCTAssertEqual(viewModel.weeklyHours, 0)
        XCTAssertEqual(viewModel.monthlyHours, 0)
        XCTAssertEqual(viewModel.materialParticipationHours, 0)
        XCTAssertEqual(viewModel.materialParticipationProgress, 0)
        XCTAssertFalse(viewModel.isMaterialParticipationMet)
    }

    func testMaterialParticipationProgressCalculation() {
        let viewModel = DashboardViewModel()
        let progress50Hours = Double(50) / Double(MaterialParticipationTest.thresholdHours)
        XCTAssertEqual(progress50Hours, 0.5)

        let progress100Hours = Double(100) / Double(MaterialParticipationTest.thresholdHours)
        XCTAssertEqual(progress100Hours, 1.0)
    }
}
