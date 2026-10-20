import SwiftUI

@main
struct TinyTouchiOSApp: App {
    init() {
        ParentFeedback.shared.start()
    }

    var body: some Scene {
        WindowGroup {
            ParentDashboardView()
        }
    }
}
