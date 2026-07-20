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
    /// Never calls the cloud — fails loudly if on-device inference doesn't
    /// work, so this is a true test of the local model, not silently-billed
    /// cloud usage.
    case onDeviceOnly
    /// Default: try on-device first, fall back to cloud silently on any failure.
    case preferOnDevice
    /// Skip on-device entirely — useful for comparing answer quality or
    /// debugging without needing the on-device model downloaded.
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
