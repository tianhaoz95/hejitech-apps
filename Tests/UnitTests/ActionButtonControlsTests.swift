import XCTest
import SwiftUI
import AppIntents
@testable import Voxbrief

@MainActor
final class ActionButtonControlsTests: XCTestCase {

    func testStartCaptureIntentMetadata() {
        XCTAssertEqual(StartCaptureIntent.openAppWhenRun, true)
        XCTAssertEqual(String(describing: StartCaptureIntent.title), String(describing: LocalizedStringResource("Start Capture")))
    }

    func testQuickMemoIntentMetadata() {
        XCTAssertEqual(QuickMemoIntent.openAppWhenRun, true)
        XCTAssertEqual(String(describing: QuickMemoIntent.title), String(describing: LocalizedStringResource("Quick Memo")))
    }

    func testOpenVoxbriefIntentMetadata() {
        XCTAssertEqual(OpenVoxbriefIntent.openAppWhenRun, true)
        XCTAssertEqual(String(describing: OpenVoxbriefIntent.title), String(describing: LocalizedStringResource("Open Voxbrief")))
    }

    func testStartCaptureIntentPerformPostsNotification() async throws {
        let expectation = expectation(description: "StartCaptureIntent notification received")
        var receivedUserInfo: [AnyHashable: Any]?

        let observer = NotificationCenter.default.addObserver(
            forName: .voxbriefNavigate,
            object: nil,
            queue: .main
        ) { notification in
            receivedUserInfo = notification.userInfo
            expectation.fulfill()
        }

        defer {
            NotificationCenter.default.removeObserver(observer)
        }

        let intent = StartCaptureIntent()
        _ = try await intent.perform()

        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(receivedUserInfo?["screen"] as? String, "record")
        XCTAssertEqual(receivedUserInfo?["source"] as? String, "action_button")
    }

    func testQuickMemoIntentPerformPostsNotification() async throws {
        let expectation = expectation(description: "QuickMemoIntent notification received")
        var receivedUserInfo: [AnyHashable: Any]?

        let observer = NotificationCenter.default.addObserver(
            forName: .voxbriefNavigate,
            object: nil,
            queue: .main
        ) { notification in
            receivedUserInfo = notification.userInfo
            expectation.fulfill()
        }

        defer {
            NotificationCenter.default.removeObserver(observer)
        }

        let intent = QuickMemoIntent()
        _ = try await intent.perform()

        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(receivedUserInfo?["screen"] as? String, "record")
        XCTAssertEqual(receivedUserInfo?["source"] as? String, "quick_memo")
    }

    func testOpenVoxbriefIntentPerformPostsNotification() async throws {
        let expectation = expectation(description: "OpenVoxbriefIntent notification received")
        var receivedUserInfo: [AnyHashable: Any]?

        let observer = NotificationCenter.default.addObserver(
            forName: .voxbriefNavigate,
            object: nil,
            queue: .main
        ) { notification in
            receivedUserInfo = notification.userInfo
            expectation.fulfill()
        }

        defer {
            NotificationCenter.default.removeObserver(observer)
        }

        let intent = OpenVoxbriefIntent()
        _ = try await intent.perform()

        await fulfillment(of: [expectation], timeout: 2.0)
        XCTAssertEqual(receivedUserInfo?["screen"] as? String, "list")
        XCTAssertEqual(receivedUserInfo?["source"] as? String, "action_button")
    }

    func testVoxbriefShortcutsProviderConfigured() {
        let shortcuts = VoxbriefShortcuts.appShortcuts
        XCTAssertEqual(shortcuts.count, 3)
    }

    func testActionButtonDeepLinkURLs() {
        let captureURL = URL(string: "voxbrief://record?source=action_button")!
        XCTAssertEqual(captureURL.scheme, "voxbrief")
        XCTAssertEqual(captureURL.host, "record")

        let components = URLComponents(url: captureURL, resolvingAgainstBaseURL: false)
        let sourceParam = components?.queryItems?.first(where: { $0.name == "source" })?.value
        XCTAssertEqual(sourceParam, "action_button")

        let memoURL = URL(string: "voxbrief://record?source=quick_memo")!
        let memoComponents = URLComponents(url: memoURL, resolvingAgainstBaseURL: false)
        let memoSource = memoComponents?.queryItems?.first(where: { $0.name == "source" })?.value
        XCTAssertEqual(memoSource, "quick_memo")
    }
}
