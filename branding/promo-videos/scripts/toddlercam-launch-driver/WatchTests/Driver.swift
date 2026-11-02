import XCTest
/// Taps on ToddlerCam's watch remote (com.hejitech.kidscam.watchkitapp), already running.
final class Driver: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.hejitech.kidscam.watchkitapp")
    func button(_ s: String) -> XCUIElement { app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", s)).firstMatch }
    override func setUp() { continueAfterFailure = false; app.activate() }
    func testLion() {
        app.swipeUp(); app.swipeUp()
        button("Face Masks").tap()
        let lion = button("Lion")
        if !lion.isHittable { app.swipeUp() }
        lion.tap(); pause(1)
        app.navigationBars.buttons.firstMatch.tap(); pause(0.5)
        app.swipeDown(); app.swipeDown(); app.swipeDown()
    }
    /// Quack (Milo looks up), the shutter from the wrist, then the last photo on the watch.
    func testSnap() {
        pause(1.0)
        button("Quack").tap()
        cue("front=milo-surprise&once=1")
        pause(1.3)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.62)).tap() // the big shutter
        pause(2.5)
        app.swipeUp()
        button("Review Last Photo").tap()
        pause(4)
    }
}
