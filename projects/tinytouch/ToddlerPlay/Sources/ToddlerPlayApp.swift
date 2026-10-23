import SwiftUI

@main
struct ToddlerPlayApp: App {
    var body: some Scene {
        WindowGroup {
            MainContainerView()
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
        }
    }
    
    private func handleIncomingURL(_ url: URL) {
        SessionKeeper.shared.startSession()
        
        let host = url.host?.lowercased() ?? url.path.replacingOccurrences(of: "/", with: "").lowercased()
        var mode: GameMode? = nil
        if let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let modeItem = components.queryItems?.first(where: { $0.name.lowercased() == "mode" })?.value {
            mode = GameMode(rawValue: modeItem)
        } else if !host.isEmpty && host != "play" {
            mode = GameMode(rawValue: host)
        }
        TinyTouchLaunchRequest.shared.requestLaunch(mode: mode)
    }
}
