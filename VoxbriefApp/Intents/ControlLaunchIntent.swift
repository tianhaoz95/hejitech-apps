import Foundation
import AppIntents

/// Deep links the iOS 18 Control Center / Lock Screen / Action Button controls open. Handled by
/// `RootView.handleDeepLink` in `VoxbriefApp.swift`.
public enum VoxbriefControlLink {
    public static let startCapture = URL(string: "voxbrief://record?source=action_button")!
    public static let quickMemo = URL(string: "voxbrief://record?source=quick_memo")!
    public static let openVault = URL(string: "voxbrief://navigate?screen=list")!
}

/// The action behind every `VoxbriefControls` button.
///
/// Compiled into **both** the `Voxbrief` app and the `VoxbriefWidgets` extension (see
/// `project.yml`): a control's intent must exist in the app too for `openAppWhenRun` to
/// foreground it. Using a bare `OpenURLIntent` as the control's action instead runs only inside
/// the widget extension and silently does nothing for a custom-scheme URL.
@available(iOS 18.0, *)
public struct OpenVoxbriefLinkIntent: AppIntent {
    public static let title: LocalizedStringResource = "Open Voxbrief Link"
    public static let isDiscoverable = false
    public static let openAppWhenRun = true

    @Parameter(title: "Link")
    public var url: URL

    public init() {}

    public init(url: URL) {
        self.url = url
    }

    public func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(url))
    }
}
