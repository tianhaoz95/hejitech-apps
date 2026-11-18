import XCTest

/// Device flows. `testSpokenStory` listens for ~60 s: run it while a story is read aloud next to the
/// phone (scripts/device_story_test.sh has the Mac read one through its speakers).
final class RoarlyUITests: XCTestCase {
    override func setUp() { continueAfterFailure = true }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-skipOnboarding", "-proUnlocked"] + extra
        addUIInterruptionMonitor(withDescription: "permissions") { alert in
            for label in ["Allow", "OK", "Allow While Using App"] where alert.buttons[label].exists {
                alert.buttons[label].tap()
                return true
            }
            return false
        }
        app.launch()
        return app
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    func testOnboardingThenStoryScreen() {
        let app = XCUIApplication()
        app.launchArguments = ["-resetOnboarding"]
        addUIInterruptionMonitor(withDescription: "permissions") { alert in
            for label in ["Allow", "OK"] where alert.buttons[label].exists { alert.buttons[label].tap(); return true }
            return false
        }
        app.launch()
        let next = app.buttons["onboarding-next"]
        XCTAssertTrue(next.waitForExistence(timeout: 8))
        shot(app, "onboarding-1")
        next.tap(); next.tap()
        shot(app, "onboarding-3")
        next.tap()
        app.tap() // lets the interruption monitor handle the permission alerts
        XCTAssertTrue(app.buttons["lantern"].waitForExistence(timeout: 15))
        shot(app, "story-idle")
    }

    func testLibrarySettingsAndPaywall() {
        let app = launch()
        XCTAssertTrue(app.buttons["lantern"].waitForExistence(timeout: 8))
        app.buttons["library"].tap()
        XCTAssertTrue(app.buttons["tile-lion"].waitForExistence(timeout: 5))
        shot(app, "library")
        app.buttons["tile-lion"].tap()
        sleep(2)
        app.buttons["Done"].firstMatch.tap()
        app.buttons["settings"].tap()
        XCTAssertTrue(app.staticTexts["Settings"].waitForExistence(timeout: 5))
        shot(app, "settings")
        app.buttons["Done"].firstMatch.tap()
        XCTAssertTrue(app.buttons["lantern"].waitForExistence(timeout: 5))
    }

    func testPaywallShows() {
        let app = XCUIApplication()
        app.launchArguments = ["-skipOnboarding", "-showPaywall"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Open the whole storybook"].waitForExistence(timeout: 8))
        sleep(4)
        shot(app, "paywall")
    }

    func testDemoStory() {
        let app = launch(["-mode", "play", "-demoStory"])
        XCTAssertTrue(app.buttons["lantern"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.buttons["ambient-rain"].waitForExistence(timeout: 30), "rain should start with the story")
        shot(app, "demo-rain")
        XCTAssertTrue(app.buttons["again-lion"].exists, "the lion should have roared")
        // "The rain stopped and the sun came out."
        let gone = NSPredicate(format: "exists == false")
        expectation(for: gone, evaluatedWith: app.buttons["ambient-rain"])
        waitForExpectations(timeout: 25)
    }

    func testSpokenStory() {
        let app = launch(["-mode", "play", "-autoListen"])
        app.tap()
        let transcript = app.otherElements["transcript"]
        XCTAssertTrue(transcript.waitForExistence(timeout: 30), "listening should start")
        shot(app, "listening")
        var heard = ""
        for _ in 0..<60 {
            sleep(1)
            let labels = app.staticTexts.allElementsBoundByIndex.map(\.label)
            heard = labels.joined(separator: " | ")
            if app.buttons["again-lion"].exists && app.buttons["ambient-rain"].exists { break }
        }
        shot(app, "spoken-story")
        print("HEARD: \(heard)")
        XCTAssertTrue(app.buttons["again-lion"].exists, "a spoken lion roar should play")
    }
}
