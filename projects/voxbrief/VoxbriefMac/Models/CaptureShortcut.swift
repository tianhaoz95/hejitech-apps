import AppKit
import CoreGraphics
import Foundation

/// Represents a configurable global keyboard shortcut to start voice capture on macOS.
public struct CaptureShortcut: Codable, Equatable, Sendable {
    public var isEnabled: Bool
    public var useBothCommandKeys: Bool
    public var keyCode: UInt16
    public var keyDisplay: String
    public var command: Bool
    public var option: Bool
    public var control: Bool
    public var shift: Bool

    public init(
        isEnabled: Bool = true,
        useBothCommandKeys: Bool = true,
        keyCode: UInt16 = 0x31, // Space
        keyDisplay: String = "Space",
        command: Bool = false,
        option: Bool = true,
        control: Bool = false,
        shift: Bool = false
    ) {
        self.isEnabled = isEnabled
        self.useBothCommandKeys = useBothCommandKeys
        self.keyCode = keyCode
        self.keyDisplay = keyDisplay
        self.command = command
        self.option = option
        self.control = control
        self.shift = shift
    }

    public var displayString: String {
        guard isEnabled else { return "Disabled" }
        if useBothCommandKeys {
            return "Both ⌘ Keys"
        }
        var result = ""
        if control { result += "⌃" }
        if option { result += "⌥" }
        if shift { result += "⇧" }
        if command { result += "⌘" }
        result += keyDisplay
        return result
    }

    public func matches(cgEvent: CGEvent) -> Bool {
        guard isEnabled && !useBothCommandKeys else { return false }
        let eventCode = UInt16(cgEvent.getIntegerValueField(.keyboardEventKeycode))
        guard self.keyCode == eventCode else { return false }
        let flags = cgEvent.flags
        return self.command == flags.contains(.maskCommand) &&
            self.option == flags.contains(.maskAlternate) &&
            self.control == flags.contains(.maskControl) &&
            self.shift == flags.contains(.maskShift)
    }

    public static let defaultShortcut = CaptureShortcut(
        isEnabled: true,
        useBothCommandKeys: true
    )

    public static let presets: [(name: String, shortcut: CaptureShortcut)] = [
        ("Both ⌘ Keys (Default)", CaptureShortcut(isEnabled: true, useBothCommandKeys: true)),
        ("⌥Space (Option + Space)", CaptureShortcut(isEnabled: true, useBothCommandKeys: false, keyCode: 0x31, keyDisplay: "Space", command: false, option: true, control: false, shift: false)),
        ("⌥⌘Space (Option + Command + Space)", CaptureShortcut(isEnabled: true, useBothCommandKeys: false, keyCode: 0x31, keyDisplay: "Space", command: true, option: true, control: false, shift: false)),
        ("⌃⌥Space (Control + Option + Space)", CaptureShortcut(isEnabled: true, useBothCommandKeys: false, keyCode: 0x31, keyDisplay: "Space", command: false, option: true, control: true, shift: false)),
    ]
}
