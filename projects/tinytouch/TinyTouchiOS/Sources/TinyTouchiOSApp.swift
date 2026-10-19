import SwiftUI

@main
struct TinyTouchiOSApp: App {
    init() {
        ParentFeedback.configure()
    }

    var body: some Scene {
        WindowGroup {
            ParentDashboardView()
        }
    }
}
