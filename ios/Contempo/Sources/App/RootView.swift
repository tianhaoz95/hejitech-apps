import ContempoCore
import FirebaseAuth
import SwiftUI

/// Watches Firebase Auth's sign-in state and swaps between `SignInScreen`
/// and the signed-in app shell — no anonymous auth fallback, matching
/// Android's `ContempoApp`: `auth.currentUser` stays nil until the user
/// actually signs in.
struct RootView: View {
    @State private var isSignedIn = Auth.auth().currentUser != nil
    @State private var authHandle: AuthStateDidChangeListenerHandle?

    var body: some View {
        Group {
            if isSignedIn {
                MainTabView()
            } else {
                SignInScreen()
            }
        }
        .contempoTheme()
        .onAppear {
            WatchAuthTokenRelay.shared.start()
            authHandle = Auth.auth().addStateDidChangeListener { _, user in
                isSignedIn = user != nil
                if user != nil {
                    WatchAuthTokenRelay.shared.sendTokenIfSignedIn()
                }
            }
        }
        .onDisappear {
            if let authHandle {
                Auth.auth().removeStateDidChangeListener(authHandle)
            }
        }
    }
}
