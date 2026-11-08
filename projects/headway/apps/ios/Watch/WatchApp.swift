import SwiftUI
import WatchKit

/// Headway on Apple Watch: glanceable Caltrain commute departure boards, live delays,
/// and train tracking directly on your wrist.
@main
struct HeadwayWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup {
            WatchBoardView()
                .environment(delegate.model)
        }
    }
}

final class WatchDelegate: NSObject, WKApplicationDelegate {
    let model = WatchModel()

    func applicationDidFinishLaunching() {
        model.activate()
    }

    /// Raising the wrist in the morning must show the morning board, not last night's cached one.
    func applicationDidBecomeActive() {
        Task { @MainActor in await model.refresh() }
    }
}
