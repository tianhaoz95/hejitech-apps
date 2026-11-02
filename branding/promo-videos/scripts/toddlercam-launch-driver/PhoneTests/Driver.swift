import XCTest
/// Taps on ToddlerCam (com.hejitech.kidscam), already running in the simulator, by screen position.
final class Driver: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.hejitech.kidscam")
    func at(_ x: Double, _ y: Double) -> XCUICoordinate { app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)) }
    override func setUp() { continueAfterFailure = false; app.activate() }
    func testTapBubble() { at(0.79, 0.26).tap() }
    func testShutter() { at(0.5, 0.913).tap(); pause(2) }
    func testLockAndTap() {
        pause(1.0)
        app.buttons.matching(NSPredicate(format: "label CONTAINS 'Lock'")).firstMatch.tap()
        pause(1.2)
        for (x, y) in [(0.3, 0.35), (0.7, 0.55), (0.45, 0.7), (0.25, 0.5), (0.65, 0.3), (0.5, 0.45), (0.35, 0.62), (0.72, 0.42), (0.4, 0.28), (0.6, 0.66)] {
            at(x, y).tap(); pause(0.22)
        }
        pause(1.5)
    }
    /// The gallery button opens the grown-ups gate. Coordinates only: the camera feed redraws all the
    /// time, so element queries wait for an idle app that never comes.
    /// Then posts a screenshot to the record script, which reads the question (simctl can't take one
    /// while it records the screen).
    func testOpenGate() {
        pause(0.5); at(0.145, 0.913).tap(); pause(1.5)
        var req = URLRequest(url: URL(string: "http://127.0.0.1:8089/gate")!)
        req.httpMethod = "POST"
        req.httpBody = XCUIScreen.main.screenshot().pngRepresentation
        let done = XCTestExpectation(description: "gate")
        URLSession.shared.dataTask(with: req) { _, _, _ in done.fulfill() }.resume()
        _ = XCTWaiter.wait(for: [done], timeout: 5)
    }
    /// Types the gate's answer, which the record script read from a screenshot (GET /answer).
    func testTypeAnswer() {
        var answer = ""
        let done = XCTestExpectation(description: "answer")
        URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:8089/answer")!) { d, _, _ in
            answer = String(data: d ?? Data(), encoding: .utf8) ?? ""; done.fulfill()
        }.resume()
        _ = XCTWaiter.wait(for: [done], timeout: 3)
        let keys: [Character: (Double, Double)] = [
            "1": (0.292, 0.521), "2": (0.497, 0.521), "3": (0.708, 0.521),
            "4": (0.292, 0.59), "5": (0.497, 0.59), "6": (0.708, 0.59),
            "7": (0.292, 0.661), "8": (0.497, 0.661), "9": (0.708, 0.661), "0": (0.497, 0.733),
        ]
        for ch in answer { if let k = keys[ch] { at(k.0, k.1).tap(); pause(0.4) } }
        pause(5)
    }
}
