import XCTest

// Runs a JSON step script (env DRIVER_SCRIPT) against any installed app and logs every action
// (wall-clock time, target frame in points) to DRIVER_LOG. Scratch tool for demo-video recordings.
final class Driver: XCTestCase {
    struct Q: Decodable { var type: String?; var label: String?; var contains: String?; var id: String?; var index: Int?; var app: String? }
    struct Step: Decodable {
        var step: String?; var `do`: String; var q: Q?; var ms: Int?; var text: String?; var label: String?
        var args: [String]?; var bundle: String?; var dx: Double?; var dy: Double?; var dur: Double?; var timeout: Double?; var optional: Bool?
    }
    struct Script: Decodable { var bundle: String; var steps: [Step] }

    var log: [[String: Any]] = []
    func now() -> Double { Date().timeIntervalSince1970 }

    func type(_ s: String?) -> XCUIElement.ElementType {
        switch s {
        case "button": return .button
        case "text": return .staticText
        case "cell": return .cell
        case "switch": return .switch
        case "field": return .textField
        case "image": return .image
        case "other": return .other
        case "tab": return .button
        case "link": return .link
        default: return .any
        }
    }

    func find(_ q: Q, _ app: XCUIApplication) -> XCUIElement {
        let root = q.app == "springboard" ? XCUIApplication(bundleIdentifier: "com.apple.springboard") : app
        var query = root.descendants(matching: type(q.type))
        if let id = q.id { query = query.matching(identifier: id) }
        if let l = q.label { query = query.matching(NSPredicate(format: "label == %@", l)) }
        if let c = q.contains { query = query.matching(NSPredicate(format: "label CONTAINS[c] %@", c)) }
        return query.element(boundBy: q.index ?? 0)
    }

    func rec(_ s: Step, _ t: Double, _ f: CGRect?) {
        var e: [String: Any] = ["step": s.step ?? "", "t": t, "type": s.do, "label": s.label ?? ""]
        if let f { e["box"] = ["x": f.minX, "y": f.minY, "w": f.width, "h": f.height] }
        log.append(e)
    }

    func testRun() throws {
        let env = ProcessInfo.processInfo.environment
        let script = try JSONDecoder().decode(Script.self, from: Data(contentsOf: URL(fileURLWithPath: env["DRIVER_SCRIPT"]!)))
        let out = URL(fileURLWithPath: env["DRIVER_LOG"]!)
        var app = XCUIApplication(bundleIdentifier: script.bundle)
        let screen = XCUIApplication(bundleIdentifier: "com.apple.springboard").frame
        defer {
            let doc: [String: Any] = ["screen": ["w": screen.width, "h": screen.height], "events": log]
            try? JSONSerialization.data(withJSONObject: doc, options: [.prettyPrinted]).write(to: out)
        }
        for s in script.steps {
            switch s.do {
            case "launch":
                if let b = s.bundle { app = XCUIApplication(bundleIdentifier: b) }
                app.launchArguments = s.args ?? []
                app.launch()
                rec(s, now(), nil)
            case "activate": app.activate(); rec(s, now(), nil)
            case "wait":
                if let q = s.q { _ = find(q, app).waitForExistence(timeout: s.timeout ?? 15) }
                rec(s, now(), nil)
            case "mark":
                let el = find(s.q!, app)
                _ = el.waitForExistence(timeout: s.timeout ?? 15)
                rec(s, now(), el.exists ? el.frame : nil)
            case "tap", "longpress", "swipeLeft", "swipeRight", "swipeUp", "swipeDown", "type", "drag":
                let el = find(s.q!, app)
                guard el.waitForExistence(timeout: s.timeout ?? 15) else {
                    if s.optional == true { continue }
                    XCTFail("not found: \(s.step ?? "") \(String(describing: s.q))"); return
                }
                let f = el.frame
                rec(s, now(), f)
                switch s.do {
                case "tap": el.tap()
                case "longpress": el.press(forDuration: s.dur ?? 1.0)
                case "swipeLeft": el.swipeLeft(velocity: .slow)
                case "swipeRight": el.swipeRight(velocity: .slow)
                case "swipeUp": el.swipeUp(velocity: .slow)
                case "swipeDown": el.swipeDown(velocity: .slow)
                case "type": el.tap(); el.typeText(s.text ?? "")
                case "drag":
                    let a = el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                    a.press(forDuration: 0.05, thenDragTo: a.withOffset(CGVector(dx: s.dx ?? 0, dy: s.dy ?? 0)), withVelocity: .slow, thenHoldForDuration: 0.1)
                default: break
                }
                // When the touch call returns, the touch has landed: the edit's ripple uses this time.
                if var last = log.popLast() { last["t2"] = now(); log.append(last) }
            case "scroll":
                // Drag the screen (no target) by dy points, slowly.
                let w = XCUIApplication(bundleIdentifier: "com.apple.springboard")
                let a = w.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.6))
                rec(s, now(), nil)
                a.press(forDuration: 0.05, thenDragTo: a.withOffset(CGVector(dx: 0, dy: s.dy ?? -300)), withVelocity: XCUIGestureVelocity(rawValue: 600), thenHoldForDuration: 0.3)
                if var last = log.popLast() { last["t2"] = now(); log.append(last) }
            case "signal":
                // Lets the recorder act at this exact moment (e.g. deliver a push): writes <text>.signal next to the log.
                rec(s, now(), nil)
                FileManager.default.createFile(atPath: ((env["DRIVER_LOG"]! as NSString).deletingLastPathComponent as NSString).appendingPathComponent("\(s.text ?? "go").signal"), contents: Data())
            case "dump":
                // The element tree, for writing step scripts (labels as the app exposes them).
                try? app.debugDescription.write(toFile: (env["DRIVER_LOG"]! as NSString).deletingPathExtension + ".tree.txt", atomically: true, encoding: .utf8)
                rec(s, now(), nil)
            case "home": rec(s, now(), nil); XCUIDevice.shared.press(.home)
            case "lock": rec(s, now(), nil); XCUIDevice.shared.perform(NSSelectorFromString("pressLockButton"))
            default: XCTFail("unknown action \(s.do)")
            }
            if let ms = s.ms { Thread.sleep(forTimeInterval: Double(ms) / 1000) }
        }
    }
}
