import Foundation
import Observation

/// Generous enough for get_current_time + up to two time-offset calls + the
/// terminal record_entry call, with slack. Mirrors Android's bounded-timeout
/// reasoning: `Conversation.sendMessage()` has been observed to wedge with
/// no exception on some devices/models — without a bound, a single capture
/// would hang Capture forever.
private let onDeviceResponseTimeoutSeconds: UInt64 = 45

/// Plain reference-type box so `LiteRtLlm.serialized(_:)` can hand a result
/// back out of a `Task` closure without `async`'s value-capture rules
/// fighting a `var` declared outside it.
private final class ResultBox<T> {
    var value: T?
}

/// LiteRT-LM implementation of `OnDeviceLlm`, running a downloaded Gemma 4
/// E2B model — see that protocol's doc comment for why this replaced the
/// `NoOpOnDeviceLlm` placeholder. The model itself isn't bundled in the app
/// (Google's own guidance: too large) — it's downloaded on demand via
/// `ModelDownloader`.
@Observable
@MainActor
final class LiteRtLlm: OnDeviceLlm {
    @ObservationIgnored
    private let downloader: ModelDownloader
    @ObservationIgnored
    private let aiSettingsStore: AiSettingsStore

    // Loading a ~2.6GB model is expensive — built once, reused for the
    // process lifetime. Deliberately NOT `@ObservationIgnored` — engine load
    // finishes asynchronously well after `downloader.state` last changed (it
    // starts once the download completes, but itself takes real time), so a
    // SwiftUI view reading `status` needs its own mutation of these two
    // properties tracked, or the view never re-renders past "checking" once
    // the download hits 100% and stays frozen there until something
    // unrelated forces a re-render.
    private var engine: Engine?
    @ObservationIgnored
    private var engineLoadTask: Task<Engine?, Never>?
    private var engineLoadFailed = false

    private(set) var lastCallTokenUsage: TokenUsage?

    // There's only one physical on-device model, so there's no legitimate
    // reason for two generation calls to run concurrently — and a real
    // reason not to: `extractEntryDraft`'s tool-call result flows through
    // `EntryDraftCapture.shared`, a single global slot with no per-call
    // isolation, so two overlapping `extractEntryDraft` calls (e.g. a
    // still-processing voice capture and a freshly-submitted text capture)
    // could each grab the other's captured draft, or find the slot already
    // cleared by the time they read it. Chaining every call through this
    // tail Task means each one waits for the previous to fully finish
    // before it starts.
    private var generationTail: Task<Void, Never> = Task {}

    private func serialized<T>(_ work: @escaping () async -> T) async -> T {
        let previous = generationTail
        let box = ResultBox<T>()
        let task = Task {
            _ = await previous.value
            box.value = await work()
        }
        generationTail = task
        await task.value
        return box.value!
    }

    /// `conversation.getBenchmarkInfo()` reports lastPrefillTokenCount
    /// (input)/lastDecodeTokenCount (output) for whatever call just ran on
    /// this Conversation — every call site below creates a fresh
    /// Conversation used exactly once, so there's no cross-call
    /// contamination to worry about. Best-effort: a benchmark-info failure
    /// should never affect the actual generation result, so this is called
    /// after the real response is already in hand and any thrown error here
    /// is swallowed. Requires `ExperimentalFlags.enableBenchmark` to have
    /// been set to `true` before the Engine that owns `conversation` was
    /// created (see `ensureEngine`) — it's baked into native engine
    /// settings at construction time, not read per-call.
    private func recordTokenUsage(_ conversation: Conversation) {
        guard let info = try? conversation.getBenchmarkInfo() else { return }
        lastCallTokenUsage = TokenUsage(inputTokens: info.lastPrefillTokenCount, outputTokens: info.lastDecodeTokenCount)
    }

    /// Derived from `downloader.state` (an `@Observable` object of its own)
    /// rather than mirrored into a separately-set stored property, so a
    /// SwiftUI view reading this live reflects `ModelDownloader`'s
    /// continuously-updating progress during the download itself, not just
    /// a value snapshotted once download start/finish.
    var status: OnDeviceModelUiStatus {
        switch downloader.state {
        case .notStarted:
            return engine != nil ? .available : .notDownloaded
        case .downloading(let bytesDownloaded, let totalBytes, let bytesPerSecond):
            let etaSeconds: Int? = {
                guard let bytesPerSecond, bytesPerSecond > 0, totalBytes > bytesDownloaded else { return nil }
                return Int(Double(totalBytes - bytesDownloaded) / bytesPerSecond)
            }()
            return .downloading(bytesDownloaded: bytesDownloaded, totalBytes: totalBytes, bytesPerSecond: bytesPerSecond, etaSeconds: etaSeconds)
        case .completed:
            if engine != nil { return .available }
            return engineLoadFailed ? .failed(message: "Couldn't load the on-device model") : .checking
        case .failed(let message):
            return .failed(message: message)
        }
    }

    init(downloader: ModelDownloader, aiSettingsStore: AiSettingsStore) {
        self.downloader = downloader
        self.aiSettingsStore = aiSettingsStore
        Task { [weak self] in
            guard let self else { return }
            if self.aiSettingsStore.preference != .cloudOnly {
                await self.checkAndMaybeDownload()
                _ = await self.ensureEngine()
            }
        }
    }

    func retry() {
        Task {
            await checkAndMaybeDownload()
            _ = await ensureEngine()
        }
    }

    func deleteDownloadedModel() {
        engineLoadTask?.cancel()
        engineLoadTask = nil
        engine = nil
        engineLoadFailed = false
        downloader.deleteDownloadedModel()
        // Immediately re-check rather than leaving `status` sitting at
        // `.notDownloaded` until something else happens to call `retry()` —
        // without this, deleting used to strand the UI with no indication
        // anything could be done next.
        retry()
    }

    private func checkAndMaybeDownload() async {
        guard !downloader.isDownloaded() else { return }
        guard downloader.hasEnoughFreeSpace() else { return }
        await downloader.start()
    }

    private func ensureEngine() async -> Engine? {
        if let engine { return engine }
        if let engineLoadTask { return await engineLoadTask.value }
        guard downloader.isDownloaded() else { return nil }

        let modelPath = downloader.modelFile.path
        let task = Task<Engine?, Never> {
            do {
                // visionBackend was left at its `nil` default here, which
                // (per EngineConfig's own doc comment) skips initializing
                // the vision executor entirely — the engine still loaded
                // fine and reported `.available`, but every image-input
                // call (generateFromImage: photo drafting, odometer OCR,
                // photo-intent classification, photo questions in Chat)
                // silently failed inside the native call, which
                // generateFromImage's `try?` then swallowed into a plain
                // `nil`, surfacing as "on-device model unavailable" even
                // though this is the same multimodal Gemma model already
                // working fine for text. Passing the same CPU backend here
                // loads the vision executor alongside the text one.
                // Must be set before Engine(...) below — it's baked into the
                // engine's native settings at construction time, not read
                // per-call, so setting it later (e.g. right before
                // getBenchmarkInfo()) would silently do nothing and leave
                // token usage uncaptured for this engine's whole lifetime.
                ExperimentalFlags.optIntoExperimentalAPIs()
                ExperimentalFlags.enableBenchmark = true
                let config = try EngineConfig(modelPath: modelPath, backend: .cpu(), visionBackend: .cpu())
                let engine = Engine(engineConfig: config)
                try await engine.initialize()
                return engine
            } catch {
                return nil
            }
        }
        engineLoadTask = task
        let result = await task.value
        if let result {
            engine = result
        } else {
            engineLoadFailed = true
        }
        engineLoadTask = nil
        return result
    }

    func generateText(_ prompt: String) async -> String? {
        await serialized {
            guard let engine = await self.ensureEngine() else { return nil }
            return try? await withTimeout(seconds: onDeviceResponseTimeoutSeconds) {
                let conversation = try await engine.createConversation()
                let response = try await conversation.sendMessage(Message(prompt))
                await self.recordTokenUsage(conversation)
                return response.toString.isEmpty ? nil : response.toString
            }
        }
    }

    func generateFromImage(_ imageData: Data, prompt: String) async -> String? {
        await serialized {
            guard let engine = await self.ensureEngine() else { return nil }
            return try? await withTimeout(seconds: onDeviceResponseTimeoutSeconds) {
                let conversation = try await engine.createConversation()
                let response = try await conversation.sendMessage(Message(of: .imageData(imageData), .text(prompt)))
                await self.recordTokenUsage(conversation)
                return response.toString.isEmpty ? nil : response.toString
            }
        }
    }

    func generateTextStream(_ prompt: String, onEvent: @escaping (GenerationEvent) -> Void) async -> String? {
        guard let engine = await ensureEngine() else { return nil }
        onEvent(.prefilling)
        return await serialized {
            try? await withTimeout(seconds: onDeviceResponseTimeoutSeconds) {
                let conversation = try await engine.createConversation()
                var accumulated = ""
                var chunkCount = 0
                for try await chunk in conversation.sendMessageStream(Message(prompt)) {
                    accumulated += chunk.toString
                    chunkCount += 1
                    onEvent(.streaming(textSoFar: accumulated, chunkCount: chunkCount))
                }
                await self.recordTokenUsage(conversation)
                return accumulated.isEmpty ? nil : accumulated
            }
        }
    }

    func extractEntryDraft(rawText: String, knownProperties: [String]) async -> EntryDraft? {
        await serialized {
            guard let engine = await self.ensureEngine() else { return nil }
            return try? await withTimeout(seconds: onDeviceResponseTimeoutSeconds) {
                // No `automaticToolCalling` param on this vendored API version —
                // tool execution is always automatic (see Conversation.sendMessage).
                let config = ConversationConfig(
                    systemMessage: Message(EntryTools.buildSystemPrompt(knownProperties: knownProperties), role: .system),
                    tools: EntryTools.all()
                )
                let conversation = try await engine.createConversation(with: config)
                _ = try await conversation.sendMessage(Message(rawText))
                await self.recordTokenUsage(conversation)
                return await EntryDraftCapture.shared.takeCaptured()
            }
        }
    }
}
