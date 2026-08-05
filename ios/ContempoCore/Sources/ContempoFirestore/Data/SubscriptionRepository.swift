import FirebaseAuth
import FirebaseFirestore
import Foundation

private let activeSubscriptionStatuses: Set<String> = ["active", "trialing", "past_due"]

/// users/{uid}/billing/subscription, synced only by the stripeWebhook Cloud
/// Function (backend/functions-billing/) — never client-written, see
/// firestore.rules. Re-subscribes across sign-in/out via an auth state
/// listener, so this is safe to start observing from app launch, before any
/// user is confirmed signed in (unlike FirestoreEntryRepository, which
/// assumes a signed-in uid already).
public final class SubscriptionRepository: @unchecked Sendable {
    private let firestore: Firestore
    private let auth: Auth

    public init(firestore: Firestore, auth: Auth) {
        self.firestore = firestore
        self.auth = auth
    }

    public func observeHasProEntitlement() -> AsyncStream<Bool> {
        AsyncStream { continuation in
            var docRegistration: ListenerRegistration?

            func subscribe(uid: String?) {
                docRegistration?.remove()
                docRegistration = nil
                guard let uid else {
                    continuation.yield(false)
                    return
                }
                docRegistration = firestore.collection("users").document(uid)
                    .collection("billing").document("subscription")
                    .addSnapshotListener { snapshot, error in
                        if error != nil {
                            // Fail closed — treat as no entitlement rather
                            // than risk unlocking cloud AI on a permission error.
                            continuation.yield(false)
                            return
                        }
                        let status = snapshot?.data()?["status"] as? String
                        continuation.yield(status.map { activeSubscriptionStatuses.contains($0) } ?? false)
                    }
            }

            let authHandle = auth.addStateDidChangeListener { auth, _ in
                subscribe(uid: auth.currentUser?.uid)
            }
            continuation.onTermination = { _ in
                self.auth.removeStateDidChangeListener(authHandle)
                docRegistration?.remove()
            }
        }
    }
}
