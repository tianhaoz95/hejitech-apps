import Foundation

struct TimeoutError: Error {}

/// A stalled native/network call has no bound of its own — without this,
/// whatever awaits it would hang forever. Races `operation` against a sleep
/// that throws `TimeoutError`, cancelling whichever loses.
func withTimeout<T: Sendable>(seconds: UInt64, operation: @escaping @Sendable () async throws -> T) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await operation() }
        group.addTask {
            try await Task.sleep(nanoseconds: seconds * 1_000_000_000)
            throw TimeoutError()
        }
        let result = try await group.next()!
        group.cancelAll()
        return result
    }
}
