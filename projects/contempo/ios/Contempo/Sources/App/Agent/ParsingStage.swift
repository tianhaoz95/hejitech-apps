/// Coarse progress signal for `AgentClient.parseEntry` — surfaced by Capture
/// while parsing a voice/text draft so a slow on-device→cloud fallback reads
/// as "working through steps," not hung.
public enum ParsingStage: Sendable {
    case idle
    case reading
    case tryingOnDevice
    case structuring
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

/// Ready as soon as either tier can answer: the bundled model, or the downloaded large one.
public func aiAvailability(bundledModelReady: Bool, onDeviceStatus: OnDeviceModelUiStatus) -> AiAvailability {
    if bundledModelReady { return .ready }
    switch onDeviceStatus {
    case .available: return .ready
    case .checking, .notDownloaded: return .checking
    case .downloading: return .downloading
    case .unavailable: return .unavailable
    case .failed(let message): return .failed(message: message)
    }
}
