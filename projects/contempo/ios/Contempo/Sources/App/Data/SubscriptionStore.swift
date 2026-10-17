import ContempoFirestore
import FirebaseAuth
import FirebaseFirestore
import Foundation
import Observation

/// Wraps SubscriptionRepository's live Firestore listener into an
/// @Observable value ServiceLocator's AgentClient closure and SettingsView
/// can both read synchronously — same role as RemoteConfigStore, but pushed
/// live from Firestore instead of pulled from Remote Config. Fails closed
/// (starts false) until the first snapshot arrives, per
/// reports/pricing-proposal-v0.html §3.2 — never risk unlocking cloud AI for
/// a Free account.
@Observable
@MainActor
final class SubscriptionStore {
    private let repository: SubscriptionRepository

    private(set) var hasProEntitlement = false

    init(firestore: Firestore = Firestore.firestore(), auth: Auth = Auth.auth()) {
        repository = SubscriptionRepository(firestore: firestore, auth: auth)
        Task { [weak self] in
            guard let stream = self?.repository.observeHasProEntitlement() else { return }
            for await value in stream {
                self?.hasProEntitlement = value
            }
        }
    }
}
