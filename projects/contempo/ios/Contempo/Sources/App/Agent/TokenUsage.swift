import Foundation

/// Token counts from the most recently completed on-device generate call
/// (prefill = input, decode = output) — see `OnDeviceLlm.lastCallTokenUsage`.
/// Ephemeral, not Firestore-persisted (compare `TokenUsageWeek`, the
/// accumulated-per-week shape this feeds into via
/// `EntryRepository.recordOnDeviceTokenUsage`).
public struct TokenUsage: Equatable, Sendable {
    public let inputTokens: Int
    public let outputTokens: Int

    public init(inputTokens: Int, outputTokens: Int) {
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
    }
}
