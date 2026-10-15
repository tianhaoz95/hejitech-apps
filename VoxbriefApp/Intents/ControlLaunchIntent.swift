import Foundation
import AppIntents

/// Deep links the iOS 18 Control Center / Lock Screen / Action Button controls open. Handled by
/// `RootView.handleDeepLink` in `VoxbriefApp.swift`.
public enum VoxbriefControlLink {
    public static let startCapture = URL(string: "voxbrief://record?source=action_button")!
    public static let quickMemo = URL(string: "voxbrief://record?source=quick_memo")!
    public static let openVault = URL(string: "voxbrief://navigate?screen=list")!
}

/// Hands a deep link from `OpenVoxbriefLinkIntent` to the running app. `RootView` subscribes to
/// `pending` and routes it through `handleDeepLink`; because `@Published` replays its current
/// value to new subscribers, a link set during a cold launch -- before any view exists -- is
/// still delivered once the UI comes up.
@MainActor
public final class VoxbriefDeepLinkInbox: ObservableObject {
    public static let shared = VoxbriefDeepLinkInbox()

    @Published public private(set) var pending: URL?

    public func deliver(_ url: URL) {
        pending = url
    }

    /// Returns and clears the pending link so it's handled exactly once.
    public func take() -> URL? {
        defer { pending = nil }
        return pending
    }
}

/// The action behind every `VoxbriefControls` button.
///
/// Compiled into **both** the `Voxbrief` app and the `VoxbriefWidgets` extension (see
/// `project.yml`): a control's intent must exist in the app too for `openAppWhenRun` to
/// foreground it, and with it set the system runs `perform()` in the app's process. A bare
/// `OpenURLIntent` as the control's action runs only inside the widget extension and silently
/// does nothing for a custom-scheme URL, and returning one as `opensIntent` from here opens the
/// app without ever delivering the URL to `onOpenURL` -- so the link is handed to the app
/// directly instead.
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

    @MainActor
    public func perform() async throws -> some IntentResult {
        VoxbriefDeepLinkInbox.shared.deliver(url)
        return .result()
    }
}
