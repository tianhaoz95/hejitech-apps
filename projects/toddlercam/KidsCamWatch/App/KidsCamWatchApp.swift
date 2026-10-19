import SwiftUI

@main
struct KidsCamWatchApp: App {
    @StateObject private var sessionManager = WatchSessionManager.shared

    var body: some Scene {
        WindowGroup {
            WatchRemoteControlView()
                .environmentObject(sessionManager)
        }
    }
}
