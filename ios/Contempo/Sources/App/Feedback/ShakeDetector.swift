import SwiftUI
import UIKit

extension Notification.Name {
    static let deviceDidShake = Notification.Name("deviceDidShake")
}

/// SwiftUI has no native shake hook and this app has no `AppDelegate`/
/// `UIApplicationDelegateAdaptor` to hang a window-level `motionEnded`
/// override off of — this is the standard workaround: an invisible
/// `UIViewController` that becomes first responder and overrides
/// `motionEnded(_:with:)`, posting a notification the rest of the app can
/// observe from anywhere (see `RootView`).
private final class ShakeDetectingViewController: UIViewController {
    override var canBecomeFirstResponder: Bool { true }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
    }

    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake {
            NotificationCenter.default.post(name: .deviceDidShake, object: nil)
        }
    }
}

struct ShakeDetector: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        ShakeDetectingViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
