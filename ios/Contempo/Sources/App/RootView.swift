import ContempoCore
import FirebaseAuth
import SwiftUI
import UIKit

/// Watches Firebase Auth's sign-in state and swaps between `SignInScreen`
/// and the signed-in app shell — no anonymous auth fallback, matching
/// Android's `ContempoApp`: `auth.currentUser` stays nil until the user
/// actually signs in.
struct RootView: View {
    @State private var isSignedIn = Auth.auth().currentUser != nil
    @State private var authHandle: AuthStateDidChangeListenerHandle?
    @State private var pendingFeedbackScreenshot: FeedbackScreenshot?

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
        // Invisible — only exists to become first responder and forward
        // `motionEnded` shake events. See Feedback/ShakeDetector.swift.
        .background(ShakeDetector().frame(width: 0, height: 0))
        .onReceive(NotificationCenter.default.publisher(for: .deviceDidShake)) { _ in
            guard isSignedIn, ServiceLocator.shakeToReportSettingsStore.enabled else { return }
            if let image = captureScreenshot() {
                pendingFeedbackScreenshot = FeedbackScreenshot(image: image)
            }
        }
        .fullScreenCover(item: $pendingFeedbackScreenshot) { screenshot in
            FeedbackAnnotationView(image: screenshot.image) {
                pendingFeedbackScreenshot = nil
            }
            // fullScreenCover content is a separate presentation context —
            // re-resolving \.contempoPalette here (rather than trusting it
            // to inherit from the .contempoTheme() applied to this same
            // Group above) is what actually makes this screen follow dark
            // mode; without it, FeedbackAnnotationView silently fell back
            // to ContempoPaletteKey's light defaultValue.
            .contempoTheme()
        }
    }

    /// Renders the active window's current contents into a `UIImage` —
    /// works regardless of which SwiftUI tab/screen is on screen, no
    /// per-screen opt-in needed.
    private func captureScreenshot() -> UIImage? {
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
            let window = windowScene.windows.first(where: { $0.isKeyWindow }) ?? windowScene.windows.first
        else { return nil }

        let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
        return renderer.image { _ in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
        }
    }
}

/// `fullScreenCover(item:)` needs `Identifiable` — `UIImage` isn't, so this
/// wraps one with a fresh identity per capture.
private struct FeedbackScreenshot: Identifiable {
    let id = UUID()
    let image: UIImage
}
