import SwiftUI

@main
struct ToddlerPlayApp: App {
    var body: some Scene {
        WindowGroup {
            MainContainerView()
                .onOpenURL { url in
                    // Instantly activated from watch face complication
                    SessionKeeper.shared.startSession()
                }
        }
    }
}
