import FeedbackKit
import UIKit

/// Shake to report a problem (FeedbackKit project "ToddlerCam"). Off by default: a parent turns it
/// on in the Parent Settings hub (behind `ParentGateView`). While it's off, FeedbackKit does nothing
/// at all (no shake trigger, no "is it fixed?" card), so a toddler shaking the phone never opens a
/// report. Nothing is sent unless the parent submits one.
enum ParentFeedback {
    static let key = "shakeToReport"

    static var isEnabled: Bool { UserDefaults.standard.bool(forKey: key) }

    /// Once at launch (the app's init): configures FeedbackKit and applies the saved setting.
    static func configure() {
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "pk_6619b4d70c72fd8f73413dc1d070e6ab0206"
        ))
        apply(enabled: isEnabled)
    }

    static func apply(enabled: Bool) {
        if enabled {
            FeedbackKit.enableShakeToReport(presenter: topViewController)
            FeedbackKit.enableFixVerification(presenter: topViewController)
        } else {
            FeedbackKit.disableShakeToReport()
            FeedbackKit.disableFixVerification()
        }
    }

    private static func topViewController() -> UIViewController? {
        var vc = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }
}
