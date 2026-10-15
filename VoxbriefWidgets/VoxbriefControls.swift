import WidgetKit
import SwiftUI
import AppIntents

#if canImport(WidgetKit)

@available(iOS 18.0, *)
public struct StartCaptureControl: ControlWidget {
    public static let kind: String = "com.jacksonzhou666.voxbrief.control.startCapture"

    public init() {}

    public var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenURLIntent(URL(string: "voxbrief://record?source=action_button")!)) {
                Label("Start Capture", systemImage: "mic.fill")
            }
        }
        .displayName("Start Capture")
        .description("Instantly opens Voxbrief and begins recording a voice note.")
    }
}

@available(iOS 18.0, *)
public struct QuickMemoControl: ControlWidget {
    public static let kind: String = "com.jacksonzhou666.voxbrief.control.quickMemo"

    public init() {}

    public var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenURLIntent(URL(string: "voxbrief://record?source=quick_memo")!)) {
                Label("Quick Memo", systemImage: "waveform.badge.plus")
            }
        }
        .displayName("Quick Memo")
        .description("Opens Voxbrief ready for quick memo dictation.")
    }
}

@available(iOS 18.0, *)
public struct OpenVoxbriefControl: ControlWidget {
    public static let kind: String = "com.jacksonzhou666.voxbrief.control.open"

    public init() {}

    public var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenURLIntent(URL(string: "voxbrief://navigate?screen=list")!)) {
                Label("Open Voxbrief", systemImage: "waveform")
            }
        }
        .displayName("Open Voxbrief")
        .description("Opens your Voxbrief notes vault.")
    }
}

#endif
