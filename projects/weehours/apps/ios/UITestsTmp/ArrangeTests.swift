import XCTest

final class ArrangeTests: XCTestCase {
    func any(_ app: XCUIApplication, _ id: String) -> XCUIElement { app.descendants(matching: .any)[id].firstMatch }
    func shot(_ name: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }
    func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-localSetup", "Thomas", "-categories", "all", "-screen", "arrange", "-last_seen_whats_new_version", "0.13.2"] + extra
        app.launch()
        return app
    }

    func testTiles() throws {
        let app = launch()
        let rhythm = any(app, "arrange-rhythm"), diaper = any(app, "arrange-tile.diaper"), bottle = any(app, "arrange-tile.bottle"), nursing = any(app, "arrange-tile.nursing")
        XCTAssertTrue(rhythm.waitForExistence(timeout: 20))
        let reset = any(app, "arrangeReset")
        if reset.exists { reset.tap(); sleep(1) }
        sleep(1); shot("1 arranging")
        print("T0 rhythm \(rhythm.frame) bottle \(bottle.frame) nursing \(nursing.frame) diaper \(diaper.frame)")

        // swap two buttons in a row: drag nursing (right) onto bottle's left half
        nursing.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.6, thenDragTo: bottle.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5)), withVelocity: .slow, thenHoldForDuration: 1)
        sleep(1); shot("2 nursing first")
        print("T1 bottle \(bottle.frame) nursing \(nursing.frame)")
        XCTAssertLessThan(nursing.frame.minX, bottle.frame.minX, "nursing now left of bottle")

        // a single button above the first card
        diaper.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.6, thenDragTo: rhythm.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.1)), withVelocity: .slow, thenHoldForDuration: 1)
        sleep(1); shot("3 diaper on top")
        print("T2 rhythm \(rhythm.frame) diaper \(diaper.frame)")
        XCTAssertLessThan(diaper.frame.minY, rhythm.frame.minY, "diaper above the chart")

        any(app, "arrangeDone").tap(); sleep(1)
        app.swipeDown(); sleep(1); shot("4 done")
        app.swipeUp(); sleep(1); shot("5 done scrolled")

        // kept after relaunch
        app.terminate()
        let again = launch()
        XCTAssertTrue(any(again, "arrange-rhythm").waitForExistence(timeout: 20))
        sleep(1)
        let d2 = any(again, "arrange-tile.diaper"), r2 = any(again, "arrange-rhythm")
        print("T3 rhythm \(r2.frame) diaper \(d2.frame)")
        XCTAssertLessThan(d2.frame.minY, r2.frame.minY, "order kept")
        shot("6 relaunched")
    }

    func testLegacyOrder() throws {
        // an order saved before buttons moved one by one: they stay together where "actions" was
        let app = launch(["-nowSectionOrder", "status,actions,rhythm"])
        let status = any(app, "arrange-status"), diaper = any(app, "arrange-tile.diaper"), rhythm = any(app, "arrange-rhythm")
        XCTAssertTrue(status.waitForExistence(timeout: 20))
        sleep(1); shot("legacy")
        print("L status \(status.frame) diaper \(diaper.frame) rhythm \(rhythm.frame)")
        XCTAssertLessThan(status.frame.minY, diaper.frame.minY)
        XCTAssertLessThan(diaper.frame.minY, rhythm.frame.minY)
    }
}
