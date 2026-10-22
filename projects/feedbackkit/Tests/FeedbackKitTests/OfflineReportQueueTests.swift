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

    // MARK: - Flushing (network stubbed with StubURLProtocol)

    private func queueReports(_ count: Int) {
        let env = FeedbackEnvironment(osName: "macOS", osVersion: "15.0", deviceModel: "Mac", appVersion: "1.0", appBuild: "1",
                                      bundleIdentifier: "com.example.app", screenName: "Home", locale: "en_US",
                                      screenWidthPoints: 1, screenHeightPoints: 1, screenScale: 1)
        let config = FeedbackKitConfiguration(endpointURL: URL(string: "https://stub.example/ingest")!, projectKey: "pk_test")
        for i in 0..<count {
            let report = FeedbackReport(text: "Report \(i)", screenshotRawPNG: Data([1]), screenshotAnnotatedPNG: Data([2]),
                                        annotations: [], environment: env)
            OfflineReportQueue.shared.saveItem(QueuedReportItem(queuedAt: Date(timeIntervalSince1970: Double(i)), report: report, configuration: config))
        }
    }

    private func flushAndWait() {
        let done = expectation(description: "flush")
        OfflineReportQueue.shared.flush { done.fulfill() }
        wait(for: [done], timeout: 30)
    }

    func testFlushSendsQueuedReportsAndRemovesThem() {
        StubURLProtocol.install { _ in .status(201) }
        defer { StubURLProtocol.uninstall() }
        queueReports(3)
        flushAndWait()
        XCTAssertEqual(StubURLProtocol.requestCount, 3)
        XCTAssertEqual(OfflineReportQueue.shared.pendingCount(), 0)
    }

    func testFlushStopsAtTheFirstNetworkFailureAndKeepsTheReports() {
        StubURLProtocol.install { _ in .failure(URLError(.notConnectedToInternet)) }
        defer { StubURLProtocol.uninstall() }
        queueReports(3)
        flushAndWait()
        XCTAssertEqual(StubURLProtocol.requestCount, 1, "still offline: no point trying the rest")
        XCTAssertEqual(OfflineReportQueue.shared.pendingCount(), 3)
    }

    func testFlushDropsReportsTheServerRejects() {
        StubURLProtocol.install { _ in .status(400) }
        defer { StubURLProtocol.uninstall() }
        queueReports(2)
        flushAndWait()
        XCTAssertEqual(OfflineReportQueue.shared.pendingCount(), 0)
    }

    func testFlushKeepsReportsOnServerErrors() {
        StubURLProtocol.install { _ in .status(503) }
        defer { StubURLProtocol.uninstall() }
        queueReports(2)
        flushAndWait()
        XCTAssertEqual(OfflineReportQueue.shared.pendingCount(), 2)
    }
}

/// Answers every request with a canned response, and counts them.
final class StubURLProtocol: URLProtocol, @unchecked Sendable {
    enum Answer { case status(Int), failure(Error) }
    nonisolated(unsafe) private static var answer: (URLRequest) -> Answer = { _ in .status(200) }
    nonisolated(unsafe) private(set) static var requestCount = 0
    private static let lock = NSLock()

    static func install(_ answer: @escaping (URLRequest) -> Answer) {
        lock.withLock { self.answer = answer; requestCount = 0 }
        URLProtocol.registerClass(StubURLProtocol.self)
    }

    static func uninstall() { URLProtocol.unregisterClass(StubURLProtocol.self) }

    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "stub.example" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let answer = Self.lock.withLock { () -> Answer in
            Self.requestCount += 1
            return Self.answer(request)
        }
        switch answer {
        case .status(let code):
            client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: nil)!,
                                cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data())
            client?.urlProtocolDidFinishLoading(self)
        case .failure(let error):
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
