import ContempoCore
import Foundation
@preconcurrency import Supabase

private let activeSubscriptionStatuses: Set<String> = ["active", "trialing", "past_due"]

/// Pro entitlement from contempo.subscriptions, written only by the Contempo Worker's Stripe
/// webhook (never client-writable). Subscriptions are bought on the web only; the apps just read.
public final class SubscriptionRepository: Sendable {
    public init() {}

    private struct Row: Decodable, Sendable { let status: String }

    public func observeHasProEntitlement() -> AsyncStream<Bool> {
        AsyncStream { continuation in
            let task = Task {
                for await (_, session) in ContempoBackend.client.auth.authStateChanges {
                    guard session != nil else {
                        continuation.yield(false)
                        continue
                    }
                    do {
                        for try await rows in ContempoBackend.liveRows("subscriptions", orderBy: "updated_at", ascending: false, as: Row.self) {
                            continuation.yield(rows.contains { activeSubscriptionStatuses.contains($0.status) })
                        }
                    } catch {
                        continuation.yield(false) // fail closed
                    }
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
