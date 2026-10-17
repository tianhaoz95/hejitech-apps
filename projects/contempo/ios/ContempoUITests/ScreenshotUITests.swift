import XCTest

/// Drives the app end-to-end (sign-in via the emulator's fake-auth path, one
/// sample entry via typed/manual capture, then each main tab) to produce real
/// App Store screenshots — not mockups. Requires the Firebase emulator suite
/// running against `demo-contempo` and a Debug build (which always compiles
/// with `USE_FIREBASE_EMULATOR`, see Config/Debug.xcconfig).
final class ScreenshotUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCaptureScreenshots() throws {
        let app = XCUIApplication()
        app.launch()

        let signInButton = app.buttons["Sign in with Google"]
        if signInButton.waitForExistence(timeout: 15) {
            signInButton.tap()
        }

        let captureTab = app.tabBars.buttons["Capture"]
        XCTAssertTrue(captureTab.waitForExistence(timeout: 20), "Did not reach the main tab bar after sign-in")

        // Capture the clean hero screen (mic button, no typed-mode state)
        // before doing anything else — CaptureScreen's `typeExpanded` state
        // (and sometimes the keyboard along with it) stays engaged after
        // returning from Confirm, which covers the tab bar for later taps.
        // Simplest fix: never need a clean Capture screenshot again after
        // this point.
        sleep(1)
        attach(app, name: "01-Capture")

        addSampleEntry(app)

        let dashboardTab = app.tabBars.buttons["Dashboard"]
        XCTAssertTrue(dashboardTab.waitForExistence(timeout: 10) && dashboardTab.isHittable, "Dashboard tab isn't reachable after saving the sample entry")
        dashboardTab.tap()
        sleep(1)
        attach(app, name: "02-Dashboard")

        let chatTab = app.tabBars.buttons["Chat"]
        chatTab.tap()
        sleep(1)
        attach(app, name: "03-Chat")

        let settingsTab = app.tabBars.buttons["Settings"]
        settingsTab.tap()
        sleep(1)
        attach(app, name: "04-Settings")
    }

    private func addSampleEntry(_ app: XCUIApplication) {
        let typeInstead = app.buttons["Type instead"]
        guard typeInstead.waitForExistence(timeout: 5) else { return }
        typeInstead.tap()

        let textView = app.textViews.firstMatch
        if textView.waitForExistence(timeout: 5) {
            textView.tap()
            textView.typeText("Cleaned unit, restocked supplies, and coordinated with cleaning crew after guest checkout")
        }

        let enterManually = app.buttons["Enter manually"]
        guard enterManually.waitForExistence(timeout: 5) else { return }
        enterManually.tap()

        let propertyField = app.textFields["Property name or address"]
        if propertyField.waitForExistence(timeout: 5) {
            propertyField.tap()
            propertyField.typeText("123 Ocean Ave, Malibu, CA")
        }

        let taskEditor = app.textViews.firstMatch
        if taskEditor.waitForExistence(timeout: 5) {
            taskEditor.tap()
            taskEditor.typeText("Cleaned unit, restocked supplies, and coordinated with cleaning crew after guest checkout")
        }

        let minutesField = app.textFields["Minutes"]
        if minutesField.waitForExistence(timeout: 5) {
            minutesField.tap()
            minutesField.typeText("45")
        }

        // The Confirm button sits below the fold once the number pad is up —
        // a plain tap() at that point can silently land on the keyboard
        // instead (SwiftUI Forms don't dismiss the keyboard on a bare tap,
        // only on an actual scroll/drag). Swipe up first to dismiss the
        // keyboard and bring Confirm into view.
        app.swipeUp()
        app.swipeUp()

        let confirmButton = app.buttons["Confirm"]
        if confirmButton.waitForExistence(timeout: 5) {
            XCTAssertTrue(confirmButton.isHittable, "Confirm button exists but isn't hittable")
            confirmButton.tap()
        }
        sleep(2)
    }

    private func attach(_ app: XCUIApplication, name: String) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
