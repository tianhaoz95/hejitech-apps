import AppKit
import Foundation

@MainActor
public final class CaptureShortcutStore: ObservableObject {
    public static let shared = CaptureShortcutStore()
    public static let storageKey = "capture_shortcut_config"

    @Published public var currentShortcut: CaptureShortcut {
        didSet {
            save()
        }
    }

    @Published public var isRecording: Bool = false
    private var recordingMonitor: Any?

    public init() {
        if let data = UserDefaults.standard.data(forKey: Self.storageKey),
           let decoded = try? JSONDecoder().decode(CaptureShortcut.self, from: data) {
            self.currentShortcut = decoded
        } else {
            self.currentShortcut = .defaultShortcut
        }
    }

    public var selectedPresetIndex: Int {
        get {
            for (index, preset) in CaptureShortcut.presets.enumerated() {
                if preset.shortcut.useBothCommandKeys && currentShortcut.useBothCommandKeys {
                    return index
                }
                if !preset.shortcut.useBothCommandKeys && !currentShortcut.useBothCommandKeys &&
                    preset.shortcut.keyCode == currentShortcut.keyCode &&
                    preset.shortcut.command == currentShortcut.command &&
                    preset.shortcut.option == currentShortcut.option &&
                    preset.shortcut.control == currentShortcut.control &&
                    preset.shortcut.shift == currentShortcut.shift {
                    return index
                }
            }
            return -1
        }
        set {
            guard newValue >= 0, newValue < CaptureShortcut.presets.count else { return }
            var updated = CaptureShortcut.presets[newValue].shortcut
            updated.isEnabled = currentShortcut.isEnabled
            currentShortcut = updated
        }
    }

    public var isCustomShortcut: Bool {
        selectedPresetIndex == -1
    }

    public func resetToDefault() {
        cancelRecording()
        currentShortcut = .defaultShortcut
    }

    private func save() {
        if let encoded = try? JSONEncoder().encode(currentShortcut) {
            UserDefaults.standard.set(encoded, forKey: Self.storageKey)
        }
    }

    public func toggleRecording() {
        if isRecording {
            cancelRecording()
        } else {
            startRecording()
        }
    }

    public func startRecording() {
        cancelRecording()
        isRecording = true

        recordingMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown]) { [weak self] event in
            guard let self, self.isRecording else { return event }

            if event.keyCode == 53 { // Escape
                self.cancelRecording()
                return nil
            }

            let flags = event.modifierFlags.intersection([.command, .option, .control, .shift])
            guard !flags.isEmpty else {
                return nil
            }

            let keyDisplay = event.charactersIgnoringModifiers?.uppercased() ?? "Key"
            self.currentShortcut = CaptureShortcut(
                isEnabled: true,
                useBothCommandKeys: false,
                keyCode: event.keyCode,
                keyDisplay: keyDisplay,
                command: flags.contains(.command),
                option: flags.contains(.option),
                control: flags.contains(.control),
                shift: flags.contains(.shift)
            )
            self.cancelRecording()
            return nil
        }
    }

    public func cancelRecording() {
        isRecording = false
        if let monitor = recordingMonitor {
            NSEvent.removeMonitor(monitor)
            recordingMonitor = nil
        }
    }
}
