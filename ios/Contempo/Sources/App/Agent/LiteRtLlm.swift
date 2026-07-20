import Foundation
import Observation

/// Generous enough for get_current_time + up to two time-offset calls + the
/// terminal record_entry call, with slack. Mirrors Android's bounded-timeout
/// reasoning: `Conversation.sendMessage()` has been observed to wedge with
/// no exception on some devices/models — without a bound, a single capture
/// would hang Capture forever.
private let onDeviceResponseTimeoutSeconds: UInt64 = 45

/// LiteRT-LM implementation of `OnDeviceLlm`, running a downloaded Gemma 4
/// E2B model — see that protocol's doc comment for why this replaced the
/// `NoOpOnDeviceLlm` placeholder. The model itself isn't bundled in the app
/// (Google's own guidance: too large) — it's downloaded on demand via
/// `ModelDownloader`.
@MainActor
final class LiteRtLlm: OnDeviceLlm {
    private let downloader: ModelDownloader
    private let aiSettingsStore: AiSettingsStore

    // Loading a ~2.6GB model is expensive — built once, reused for the
    // process lifetime.
    private var engine: Engine?
    private var engineLoadTask: Task<Engine?, Never>?
    private var engineLoadFailed = false

    /// Derived from `downloader.state` (an `@Observable` object of its own)
    /// rather than mirrored into a separately-set stored property, so a
    /// SwiftUI view reading this live reflects `ModelDownloader`'s
    /// continuously-updating progress during the download itself, not just
    /// a value snapshotted once download start/finish.
    var status: OnDeviceModelUiStatus {
        switch downloader.state {
        case .notStarted:
            return engine != nil ? .available : .checking
        case .downloading(let bytesDownloaded, let totalBytes):
            return .downloading(bytesDownloaded: bytesDownloaded, totalBytes: totalBytes, etaSeconds: nil)
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
                let config = try EngineConfig(modelPath: modelPath, backend: .cpu())
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
        guard let engine = await ensureEngine() else { return nil }
        return try? await withTimeout(seconds: onDeviceResponseTimeoutSeconds) {
            let conversation = try await engine.createConversation()
            let response = try await conversation.sendMessage(Message(prompt))
            return response.toString.isEmpty ? nil : response.toString
        }
    }

    func generateFromImage(_ imageData: Data, prompt: String) async -> String? {
        guard let engine = await ensureEngine() else { return nil }
        return try? await withTimeout(seconds: onDeviceResponseTimeoutSeconds) {
            let conversation = try await engine.createConversation()
            let response = try await conversation.sendMessage(Message(of: .imageData(imageData), .text(prompt)))
            return response.toString.isEmpty ? nil : response.toString
        }
    }

    func generateTextStream(_ prompt: String, onEvent: @escaping (GenerationEvent) -> Void) async -> String? {
        guard let engine = await ensureEngine() else { return nil }
        onEvent(.prefilling)
        return try? await withTimeout(seconds: onDeviceResponseTimeoutSeconds) {
            let conversation = try await engine.createConversation()
            var accumulated = ""
            var chunkCount = 0
            for try await chunk in conversation.sendMessageStream(Message(prompt)) {
                accumulated += chunk.toString
                chunkCount += 1
                onEvent(.streaming(textSoFar: accumulated, chunkCount: chunkCount))
            }
            return accumulated.isEmpty ? nil : accumulated
        }
    }

    func extractEntryDraft(rawText: String, knownProperties: [String]) async -> EntryDraft? {
        guard let engine = await ensureEngine() else { return nil }
        return try? await withTimeout(seconds: onDeviceResponseTimeoutSeconds) {
            // No `automaticToolCalling` param on this vendored API version —
            // tool execution is always automatic (see Conversation.sendMessage).
            let config = ConversationConfig(
                systemMessage: Message(EntryTools.buildSystemPrompt(knownProperties: knownProperties), role: .system),
                tools: EntryTools.all()
            )
            let conversation = try await engine.createConversation(with: config)
            _ = try await conversation.sendMessage(Message(rawText))
            return await EntryDraftCapture.shared.takeCaptured()
        }
    }
}
