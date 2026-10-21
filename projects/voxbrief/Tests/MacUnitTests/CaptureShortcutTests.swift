import XCTest
@testable import VoxbriefMac

final class CaptureShortcutTests: XCTestCase {
    func testDefaultShortcutUsesBothCommandKeys() {
        let def = CaptureShortcut.defaultShortcut
        XCTAssertTrue(def.isEnabled)
        XCTAssertTrue(def.useBothCommandKeys)
        XCTAssertEqual(def.displayString, "Both ⌘ Keys")
    }

    func testCustomShortcutDisplayString() {
        let optSpace = CaptureShortcut(
            isEnabled: true,
            useBothCommandKeys: false,
            keyCode: 0x31,
            keyDisplay: "Space",
            command: false,
            option: true,
            control: false,
            shift: false
        )
        XCTAssertEqual(optSpace.displayString, "⌥Space")

        let cmdOptSpace = CaptureShortcut(
            isEnabled: true,
            useBothCommandKeys: false,
            keyCode: 0x31,
            keyDisplay: "Space",
            command: true,
            option: true,
            control: false,
            shift: false
        )
        XCTAssertEqual(cmdOptSpace.displayString, "⌥⌘Space")
    }

    func testCodableRoundTrip() throws {
        let original = CaptureShortcut(
            isEnabled: true,
            useBothCommandKeys: false,
            keyCode: 0x01,
            keyDisplay: "S",
            command: true,
            option: true,
            control: true,
            shift: true
        )
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(CaptureShortcut.self, from: data)
        XCTAssertEqual(decoded, original)
    }
}
