/// Coarse progress signal for `AgentClient.parseEntry` — surfaced by Capture
/// while parsing a voice/text draft so a slow on-device→cloud fallback reads
/// as "working through steps," not hung.
public enum ParsingStage: Sendable {
    case idle
    case reading
    case tryingOnDevice
    case fallingBackToCloud
    case structuring
}

/// User-controlled choice of how `AgentClient` splits work between the
/// on-device model (free, no network) and the cloud parseEntry/askAgent
/// Genkit flows (costs money, always available).
public enum InferencePreference: String, Sendable, CaseIterable {
    /// Default for Free accounts (see reports/pricing-proposal-v0.html §3.2) —
    /// never calls the cloud, fails loudly if on-device inference doesn't
    /// work, so this is a true test of the local model, not silently-billed
    /// cloud usage.
    case onDeviceOnly
    /// Try on-device first, fall back to cloud silently on any failure —
    /// gated behind Contempo Pro (SettingsViewModel.hasProEntitlement), since
    /// the fallback has real recurring cloud cost.
    case preferOnDevice
    /// Skip on-device entirely — gated behind Contempo Pro, same reasoning as
    /// preferOnDevice.
    case cloudOnly
}

/// Whether AI-dependent actions (parse, chat) should be enabled right now.
/// Only `.onDeviceOnly` ever blocks: `.preferOnDevice` already has a cloud
/// fallback built into `AgentClient`, so there's nothing to gate there.
public enum AiAvailability: Equatable, Sendable {
    case ready
    case checking
    case downloading
    case unavailable
    case failed(message: String)
}

public func aiAvailability(preference: InferencePreference, onDeviceStatus: OnDeviceModelUiStatus) -> AiAvailability {
    guard preference == .onDeviceOnly else { return .ready }
    switch onDeviceStatus {
    case .available: return .ready
    case .checking, .notDownloaded: return .checking
    case .downloading: return .downloading
    case .unavailable: return .unavailable
    case .failed(let message): return .failed(message: message)
    }
}
