import FirebaseFirestore
import Foundation

/// Every eagerly-observed Firestore listener in the app (Capture's open trip/
/// timer, Dashboard's entries, Confirm's properties listener) needs to survive
/// a `permissionDenied`/`unauthenticated` error without crashing the screen.
///
/// A brand-new sign-in's very first listener attach can transiently get
/// `permissionDenied` before the just-issued token has fully propagated — a
/// real race, not just an emulator quirk (mirrors Android's
/// `recoverFromAuthRaceOrSignOut`, confirmed live there). This retries once
/// after a short delay (re-invoking `factory` to attach a fresh listener,
/// since a terminated `AsyncThrowingStream` can't itself be "retried" — unlike
/// Kotlin's `Flow.retryWhen`, which re-collects the upstream flow) before
/// falling back to `onAuthFailure` + emitting `fallback()`. A second failure
/// after the retry is what actually indicates a genuinely stale/invalid
/// session.
public enum AuthAwareStream {
    private static let retryDelayNanoseconds: UInt64 = 1_000_000_000

    public static func isAuthError(_ error: Error) -> Bool {
        let nsError = error as NSError
        guard nsError.domain == FirestoreErrorDomain else { return false }
        return nsError.code == FirestoreErrorCode.permissionDenied.rawValue
            || nsError.code == FirestoreErrorCode.unauthenticated.rawValue
    }

    public static func make<T: Sendable>(
        fallback: @escaping @Sendable () -> T,
        onAuthFailure: @escaping @Sendable () async -> Void,
        factory: @escaping @Sendable () -> AsyncThrowingStream<T, Error>
    ) -> AsyncThrowingStream<T, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                var retriedOnce = false
                while !Task.isCancelled {
                    do {
                        for try await value in factory() {
                            continuation.yield(value)
                        }
                        continuation.finish()
                        return
                    } catch {
                        guard isAuthError(error) else {
                            continuation.finish(throwing: error)
                            return
                        }
                        if !retriedOnce {
                            retriedOnce = true
                            try? await Task.sleep(nanoseconds: retryDelayNanoseconds)
                            continue
                        }
                        await onAuthFailure()
                        continuation.yield(fallback())
                        continuation.finish()
                        return
                    }
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}
