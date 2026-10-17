import ContempoData
import Foundation
import Observation

/// Pro entitlement, live from contempo.subscriptions (written only by the Worker's Stripe webhook).
@Observable
@MainActor
final class SubscriptionStore {
    private let repository = SubscriptionRepository()

    private(set) var hasProEntitlement = false

    init() {
        Task { [weak self] in
            guard let stream = self?.repository.observeHasProEntitlement() else { return }
            for await value in stream {
                self?.hasProEntitlement = value
            }
        }
    }
}
