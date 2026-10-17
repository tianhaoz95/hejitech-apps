import ContempoCore
import SwiftUI

struct RootView: View {
    @State private var authManager = WatchAuthManager.shared

    var body: some View {
        Group {
            if authManager.isSignedIn {
                // .page style — the standard watchOS swipe-between-pages
                // idiom (same as the system's own Now Playing/Siri
                // watch-face-style pagers). Capture first since it's the
                // page opened on every launch; Settings (sign-out, signed-in
                // email — see WatchSettingsScreen) is a swipe away rather
                // than sharing Capture's page, which is where its "Sign
                // Out" button used to live before this split.
                TabView {
                    WatchCaptureScreen()
                    WatchSettingsScreen()
                }
                .tabViewStyle(.page)
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
