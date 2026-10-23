import SwiftUI

@main
struct KidsCamWatchApp: App {
    @StateObject private var sessionManager = WatchSessionManager.shared
    @StateObject private var watchRequest = WatchRequest.shared

    var body: some Scene {
        WindowGroup {
            WatchRemoteControlView()
                .environmentObject(sessionManager)
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
        }
    }

    private func handleIncomingURL(_ url: URL) {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let pathOrHost = (components?.host ?? url.pathComponents.dropFirst().first ?? "").lowercased()
        if pathOrHost == "shutter" || pathOrHost == "snap" || pathOrHost == "photo" {
            WatchRequest.shared.pendingAction = .shutter
        } else if pathOrHost == "sound" {
            let sound = components?.queryItems?.first(where: { $0.name == "name" })?.value ?? "quack"
            WatchRequest.shared.pendingAction = .sound(sound)
        } else {
            WatchRequest.shared.pendingAction = .remote
        }
    }
}
