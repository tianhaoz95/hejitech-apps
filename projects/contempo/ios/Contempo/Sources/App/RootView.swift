import ContempoCore
import SwiftUI

/// Watches Firebase Auth's sign-in state and swaps between `SignInScreen`
/// and the signed-in app shell — no anonymous auth fallback, matching
/// Android's `ContempoApp`: `auth.currentUser` stays nil until the user
/// actually signs in.
struct RootView: View {
    @State private var isSignedIn = ContempoBackend.client.auth.currentUser != nil

    var body: some View {
        Group {
            // Device-scoped, checked ahead of sign-in — shown once regardless
            // of whether this device already has a signed-in account (see
            // OnboardingStore's doc comment).
            if !ServiceLocator.onboardingStore.hasCompleted {
                OnboardingView()
            } else if isSignedIn {
                MainTabView()
            } else {
                SignInScreen()
            }
        }
        .contempoTheme()
        .onAppear {
            WatchAuthTokenRelay.shared.start()
        }
        .task {
            for await (_, session) in ContempoBackend.client.auth.authStateChanges {
                isSignedIn = session != nil
                if session != nil {
                    WatchAuthTokenRelay.shared.sendTokenIfSignedIn()
                }
            }
        }
    }
}

