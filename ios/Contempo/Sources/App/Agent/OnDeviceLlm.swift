import Foundation

/// UI-facing view of an on-device LLM's readiness — deliberately generic,
/// shared by every `OnDeviceLlm` implementation so `AgentClient`/
/// `CaptureViewModel`/`ChatViewModel`/`SettingsScreen` gate on one shape
/// regardless of which runtime is active underneath. The point is
/// discovering readiness ahead of time, not just "unavailable" after a
/// failed generation call.
public enum OnDeviceModelUiStatus: Equatable, Sendable {
    case checking
    /// Hardware/OS doesn't support on-device inference at all — cloud is the only option here.
    case unavailable
    /// Known downloadable but not currently being fetched — either briefly
    /// at launch before the automatic check kicks in, or a steady state
    /// after the user deletes a previously-downloaded model. Settings shows
    /// a manual "Download" button here.
    case notDownloaded
    /// `totalBytes` is 0 if a download-started event was never observed —
    /// render as indeterminate progress in that case. `bytesPerSecond` and
    /// `etaSeconds` are nil until enough samples exist to estimate throughput.
    case downloading(bytesDownloaded: Int64, totalBytes: Int64, bytesPerSecond: Double?, etaSeconds: Int?)
    case available
    case failed(message: String)
}

/// Live progress during on-device text generation.
public enum GenerationEvent: Sendable {
    /// Sent, waiting for the first chunk — this window is the model's prefill phase.
    case prefilling
    /// `textSoFar` is the full accumulated answer so far (not just the
    /// latest chunk). `chunkCount` counts callbacks received — a close proxy
    /// for tokens generated, not an exact token count.
    case streaming(textSoFar: String, chunkCount: Int)
}

/// Framework-agnostic on-device LLM capability. `AgentClient` (the only
/// caller) only ever sees this protocol — never a specific runtime's types
/// directly. Swapping the underlying runtime means writing a new conformance
/// and changing one line in `ServiceLocator`.
public protocol OnDeviceLlm: AnyObject, Sendable {
    @MainActor var status: OnDeviceModelUiStatus { get }

    /// Re-checks readiness and (re)starts a stalled/failed download. User-triggered from Settings.
    func retry()

    /// Deletes the downloaded model (if any) and releases any loaded engine,
    /// returning to `.notDownloaded`/`.checking`. User-triggered from
    /// Settings, either to free storage or to force a clean re-download.
    func deleteDownloadedModel()

    /// Plain text in, plain text out — callers handle their own prompt
    /// construction and response parsing. Nil on any failure: unsupported,
    /// not ready, or a generation error.
    func generateText(_ prompt: String) async -> String?

    /// Nil if this runtime/model doesn't support image input, isn't ready, or generation fails.
    func generateFromImage(_ imageData: Data, prompt: String) async -> String?

    /// Same contract as `generateText` (nil on any failure/unsupported), but
    /// reports live progress via `onEvent` as generation actually happens.
    func generateTextStream(_ prompt: String, onEvent: @escaping (GenerationEvent) -> Void) async -> String?

    /// Structured entry extraction via tool-calling, when the runtime
    /// supports it. Nil on any failure — same "unavailable" contract as
    /// `generateText`.
    func extractEntryDraft(rawText: String, knownProperties: [String]) async -> EntryDraft?
}

/// Placeholder used until the real LiteRT-LM-backed implementation is wired
/// in — always reports `.unavailable` and returns nil, so `AgentClient`'s
/// cloud fallback path (`preferOnDevice`/`cloudOnly`) is fully exercisable
/// today; only `onDeviceOnly` would ever notice this isn't real yet.
public final class NoOpOnDeviceLlm: OnDeviceLlm {
    public init() {}

    @MainActor public var status: OnDeviceModelUiStatus { .unavailable }
    public func retry() {}
    public func deleteDownloadedModel() {}
    public func generateText(_ prompt: String) async -> String? { nil }
    public func generateFromImage(_ imageData: Data, prompt: String) async -> String? { nil }
    public func generateTextStream(_ prompt: String, onEvent: @escaping (GenerationEvent) -> Void) async -> String? { nil }
    public func extractEntryDraft(rawText: String, knownProperties: [String]) async -> EntryDraft? { nil }
}
