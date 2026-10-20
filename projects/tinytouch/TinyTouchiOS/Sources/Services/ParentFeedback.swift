import FeedbackKit
import StoreKit
import UIKit

/// Shake to report a problem (FeedbackKit project "TinyTouch"), for TestFlight testers only.
///
/// App Store installs never configure FeedbackKit and never show the setting, so the released app
/// sends nothing and its privacy policy ("no data collection") stays true. On TestFlight (and Debug
/// builds) a parent can turn it on under Beta Feedback on the parent dashboard; it defaults to
/// off, and while off FeedbackKit does nothing at all (no shake trigger, no "is it fixed?" card), so
/// a toddler shaking the phone never opens a report.
@MainActor
final class ParentFeedback: ObservableObject {
    static let shared = ParentFeedback()
    static let key = "shakeToReport"

    /// True once the app knows it's a TestFlight (or Debug) install. Drives the settings toggle.
    @Published private(set) var isAvailable = false

    /// Once at launch: finds out where the app came from, and only then configures FeedbackKit.
    func start() {
        Task {
            guard await Self.isTestFlightOrDebug() else { return }
            FeedbackKit.configure(.init(
                endpointURL: URL(string: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback")!,
                projectKey: "pk_66d3a549ae0915c22927f9c7b417ce337c85"
            ))
            isAvailable = true
            apply(enabled: UserDefaults.standard.bool(forKey: Self.key))
        }
    }

    func apply(enabled: Bool) {
        if isAvailable && enabled {
            FeedbackKit.enableShakeToReport(presenter: Self.topViewController)
            FeedbackKit.enableFixVerification(presenter: Self.topViewController)
        } else {
            FeedbackKit.disableShakeToReport()
            FeedbackKit.disableFixVerification()
        }
    }

    /// TestFlight builds are signed for the sandbox; App Store builds for production. Anything we
    /// can't verify (no receipt yet, offline first launch) counts as the App Store.
    private static func isTestFlightOrDebug() async -> Bool {
        #if DEBUG
        return true
        #else
        guard let transaction = try? await AppTransaction.shared else { return false }
        return transaction.unsafePayloadValue.environment == .sandbox
        #endif
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
