import FeedbackKit
import UIKit

/// Shake to report, through FeedbackKit: the SDK captures the screenshot, lets the user mark it up
/// and describe the problem, and sends it to Contempo's FeedbackKit project, where it's triaged
/// (dashboard, Portal app or `npx feedbackkit-cli`). Opt-in from Settings
/// (`ShakeToReportSettingsStore`); turning it off also stops the "is it fixed?" prompt for the
/// reporter's earlier reports. Mirrors Android's `feedback/FeedbackReporting.kt`.
@MainActor
enum FeedbackReporting {
    static func configure() {
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "pk_e34cf12ad7d2c103d4ce464337ecf0869f6b"
        ))
        FeedbackKit.theme = .init(primaryColorHex: "#1F5C46", secondaryColorHex: "#A67C34")   // pine, brass
        apply(enabled: ServiceLocator.shakeToReportSettingsStore.enabled)
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
