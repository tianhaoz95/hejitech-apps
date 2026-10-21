import XCTest
@testable import FeedbackKit

final class OfflineReportQueueTests: XCTestCase {
    override func setUp() {
        super.setUp()
        OfflineReportQueue.shared.clearAll()
    }

    override func tearDown() {
        OfflineReportQueue.shared.clearAll()
        FeedbackKit.configure(nil)
        super.tearDown()
    }

    func testEnqueueAndLoadPendingReports() {
        let queue = OfflineReportQueue.shared
        XCTAssertEqual(queue.pendingCount(), 0)

        let env = FeedbackEnvironment(
            osName: "macOS",
            osVersion: "15.0",
            deviceModel: "MacBookPro",
            appVersion: "1.0",
            appBuild: "1",
            bundleIdentifier: "com.example.app",
            screenName: "Home",
            locale: "en_US",
            screenWidthPoints: 1200,
            screenHeightPoints: 800,
            screenScale: 2
        )
        let report = FeedbackReport(
            text: "Offline test bug report",
            screenshotRawPNG: Data([0x01]),
            screenshotAnnotatedPNG: Data([0x02]),
            annotations: [],
            environment: env
        )
        let config = FeedbackKitConfiguration(
            endpointURL: URL(string: "https://example.com/api")!,
            projectKey: "pk_test"
        )

        let item = QueuedReportItem(report: report, configuration: config)
        queue.saveItem(item)

        let loaded = queue.loadAllItems()
        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded.first?.report.text, "Offline test bug report")
        XCTAssertEqual(loaded.first?.configuration.projectKey, "pk_test")

        queue.deleteItem(id: item.id)
        XCTAssertEqual(queue.pendingCount(), 0)
    }

    func testConfigurationEncodesAndDecodes() throws {
        let config = FeedbackKitConfiguration(
            endpointURL: URL(string: "https://example.com/ingest")!,
            projectKey: "pk_sample_key",
            products: [FeedbackProduct(key: "ios", name: "iOS App")],
            defaultProductKey: "ios",
            reporterUpdatesURL: URL(string: "https://example.com/updates")!,
            spoolOfflineReports: true
        )

        let data = try JSONEncoder().encode(config)
        let decoded = try JSONDecoder().decode(FeedbackKitConfiguration.self, from: data)

        XCTAssertEqual(decoded.endpointURL, config.endpointURL)
        XCTAssertEqual(decoded.projectKey, config.projectKey)
        XCTAssertEqual(decoded.defaultProductKey, "ios")
        XCTAssertEqual(decoded.spoolOfflineReports, true)
    }
}
