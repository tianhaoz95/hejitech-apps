import ContempoCore
import SwiftUI

struct RootView: View {
    @State private var authManager = WatchAuthManager.shared

    var body: some View {
        Group {
            if authManager.isSignedIn {
                WatchCaptureScreen()
            } else {
                WatchSignInView()
            }
        }
        .contempoTheme()
        .onAppear {
            authManager.start()
        }
    }
}
