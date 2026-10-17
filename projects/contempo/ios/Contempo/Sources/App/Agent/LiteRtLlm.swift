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

    // Loading a ~2.6GB model is expensive — built once, reused for the
    // process lifetime. Deliberately NOT `@ObservationIgnored` — engine load
    // finishes asynchronously well after `downloader.state` last changed (it
    // starts once the download completes, but itself takes real time), so a
    // SwiftUI view reading `status` needs its own mutation of these two
    // properties tracked, or the view never re-renders past "checking" once
    // the download hits 100% and stays frozen there until something
    // unrelated forces a re-render.
    private var engine: Engine?
    /// The bundled small model's engine (Qwen3-0.6B, text only).
    private var bundledEngine: Engine?
    @ObservationIgnored
    private var bundledLoadTask: Task<Engine?, Never>?

    /// Qwen3-0.6B shipped in the app bundle (fetched by scripts/fetch-models.sh, not in git).
    @ObservationIgnored
    private let bundledModelURL = Bundle.main.url(forResource: "Qwen3-0.6B", withExtension: "litertlm")
    var bundledModelReady: Bool { bundledModelURL != nil }

    /// True while the downloaded large model is the one answering.
    private var usingLargeModel: Bool { downloader.isDownloaded() }
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

    /// The large model is opt-in (Settings → Download), Voxbrief-style; the bundled one answers until then.
    init(downloader: ModelDownloader) {
        self.downloader = downloader
    }

    /// Starts (or retries) the opt-in download of the large model.
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
    }

    private func checkAndMaybeDownload() async {
        guard !downloader.isDownloaded() else { return }
        guard downloader.hasEnoughFreeSpace() else { return }
        await downloader.start()
    }

    /// The engine for the best available tier: the downloaded large model, else the bundled one.
    /// Photo calls (`needsVision`) only ever get the large model.
    private func ensureEngine(needsVision: Bool = false) async -> Engine? {
        if downloader.isDownloaded() { return await ensureLargeEngine() }
        if needsVision { return nil }
        return await ensureBundledEngine()
    }

    private func ensureBundledEngine() async -> Engine? {
        if let bundledEngine { return bundledEngine }
        if let bundledLoadTask { return await bundledLoadTask.value }
        guard let path = bundledModelURL?.path else { return nil }
        let task = Task<Engine?, Never> {
            do {
                ExperimentalFlags.optIntoExperimentalAPIs()
                ExperimentalFlags.enableBenchmark = true
                // The bundle is read-only: LiteRT's weight cache goes to Caches. The model was converted
                // with a 1280-token KV cache; capping here keeps memory well under iOS's per-app limit.
                let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].path
                let engine = Engine(engineConfig: try EngineConfig(modelPath: path, backend: .cpu(), maxNumTokens: 1280, cacheDir: cacheDir))
                try await engine.initialize()
                return engine
            } catch {
                print("[LiteRtLlm] couldn't load the bundled model: \(error)")
                return nil
            }
        }
        bundledLoadTask = task
        let result = await task.value
        bundledEngine = result
        bundledLoadTask = nil
        return result
    }

    /// Qwen3 thinks out loud unless told not to.
    private func forBundled(_ prompt: String) -> String { usingLargeModel ? prompt : "/no_think\n" + prompt }

    private func ensureLargeEngine() async -> Engine? {
        if let engine { return engine }
        if let engineLoadTask { return await engineLoadTask.value }
        guard downloader.isDownloaded() else { return nil }
        bundledEngine = nil

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
                let response = try await conversation.sendMessage(Message(await self.forBundled(prompt)))
                await self.recordTokenUsage(conversation)
                let text = stripThinking(response.toString)
                return text.isEmpty ? nil : text
            }
        }
    }

    func generateFromImage(_ imageData: Data, prompt: String) async -> String? {
        await serialized {
            guard let engine = await self.ensureEngine(needsVision: true) else { return nil }
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
                for try await chunk in conversation.sendMessageStream(Message(await self.forBundled(prompt))) {
                    accumulated += chunk.toString
                    chunkCount += 1
                    onEvent(.streaming(textSoFar: stripThinking(accumulated), chunkCount: chunkCount))
                }
                await self.recordTokenUsage(conversation)
                let text = stripThinking(accumulated)
                return text.isEmpty ? nil : text
            }
        }
    }

    func extractEntryDraft(rawText: String, knownProperties: [String]) async -> EntryDraft? {
        if !usingLargeModel { return await extractEntryDraftAsJson(rawText: rawText, knownProperties: knownProperties) }
        return await serialized {
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

    /// The bundled tier's entry parse: one JSON object back, our own code builds the draft (the
    /// Voxbrief way); time references are resolved against the given current time.
    private func extractEntryDraftAsJson(rawText: String, knownProperties: [String]) async -> EntryDraft? {
        var prompt = "You extract short-term-rental work-log entries from a host's own words.\n"
        if !knownProperties.isEmpty { prompt += "Known properties: \(knownProperties.joined(separator: ", ")).\n" }
        prompt += """
        The message is dictated speech: drop filler words and fix obvious transcription errors in "task", never change the meaning.
        Current time: \(ISO8601DateFormatter().string(from: Date())). Resolve any time reference to an absolute ISO-8601 timestamp.
        Reply with only one JSON object with these keys: property, task, duration_minutes, category (one of maintenance, turnover, guest_communication, supply_run, admin, other), event_type (start, stop or null), miles, resolved_activity_date_iso. Use null for anything you can't determine. task is a short plain-English description of the work, in the host's words (e.g. \"Fixed the dishwasher\"), not an identifier.
        Host's message: "\(rawText)"
        """
        guard let text = await generateText(prompt),
              let start = text.firstIndex(of: "{"), let end = text.lastIndex(of: "}"), start < end,
              let object = try? JSONSerialization.jsonObject(with: Data(text[start...end].utf8)) as? [String: Any]
        else { return nil }
        func str(_ key: String) -> String? {
            guard let value = object[key] as? String, !value.isEmpty, value != "null" else { return nil }
            return value
        }
        func num(_ key: String) -> Double? { (object[key] as? NSNumber)?.doubleValue }
        let event = str("event_type")
        let draft = EntryDraft(
            property: str("property"),
            task: str("task"),
            durationMinutes: num("duration_minutes").map { Int($0) }.flatMap { $0 > 0 ? $0 : nil },
            category: str("category"),
            eventType: (event == "start" || event == "stop") ? event : nil,
            miles: num("miles").flatMap { $0 >= 0 ? $0 : nil },
            resolvedActivityDateIso: str("resolved_activity_date_iso")
        )
        return RuleBasedEntryParser.refineSmallModelDraft(draft, rawText: rawText, knownProperties: knownProperties)
    }
}

/// Removes Qwen3's `<think>…</think>` block (empty with /no_think) from a response.
func stripThinking(_ text: String) -> String {
    text.replacingOccurrences(of: "(?s)<think>.*?(</think>|$)", with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}
