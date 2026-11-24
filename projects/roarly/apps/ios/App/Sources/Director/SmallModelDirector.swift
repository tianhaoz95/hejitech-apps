import Combine
import Foundation
import FoundationModels
import Hub
import MLX
import MLXLLM
import MLXLMCommon
import NaturalLanguage
import RoarlyKit

/// Settles the mentions the context rules aren't sure about ("the lion was quiet… the lion")
/// with a small on-device model: Apple's where the iPhone has Apple Intelligence, otherwise the
/// language's Create ML story-sense classifier (~1–2 MB, milliseconds), or the optional on-demand
/// Qwen3 0.6B (MLX, ~335 MB) if the user downloads and enables it. One yes/no question, a hard
/// time limit; when the model is slow or missing the suggestion stays up for the parent to tap.
@MainActor
final class SmallModelDirector: ObservableObject {
    enum Engine: String {
        case apple = "Apple Intelligence"
        /// Create ML text classifier trained on sentences written and labeled by Apple's model
        /// (ml/). ~1–2 MB, milliseconds, every iPhone.
        case classifier = "Story sense"
        case builtIn = "On-demand language model"
        case none = "Off"
    }

    static let modelFolder = "Qwen3-0.6B-4bit"
    static let modelID = "mlx-community/Qwen3-0.6B-4bit"
    static let timeLimit: Duration = .milliseconds(2500)

    @Published private(set) var engine: Engine = .none
    @Published private(set) var builtInInstalled: Bool = false
    @Published private(set) var builtInDownloadProgress: Double?
    @Published private(set) var builtInError: String?

    private(set) var lastLatency: Duration?
    private var language: StoryLanguage = .english
    private var classifiers: [StoryLanguage: NLModel] = [:]
    private var container: ModelContainer?
    private var loading: Task<ModelContainer, Error>?
    private var downloadTask: Task<Void, Never>?
    private var busy = false

    static var appleAvailable: Bool { SystemLanguageModel.default.isAvailable }

    /// MLX's Metal allocator aborts in the iOS Simulator, so the on-demand MLX model is device-only.
    static var builtInSupported: Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        return true
        #endif
    }

    static var builtInAvailable: Bool {
        builtInSupported && localModelDirectory != nil
    }

    private static var modelsRoot: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("RoarlyModels", isDirectory: true)
    }

    private static var hub: HubApi {
        HubApi(downloadBase: modelsRoot)
    }

    private static var downloadedModelDirectory: URL {
        ModelConfiguration(id: modelID).modelDirectory(hub: hub)
    }

    private static var bundledModelDirectory: URL? {
        Bundle.main.url(forResource: modelFolder, withExtension: nil)
    }

    static var localModelDirectory: URL? {
        if let bundled = bundledModelDirectory,
           FileManager.default.fileExists(atPath: bundled.appendingPathComponent("model.safetensors").path) {
            return bundled
        }
        let dl = downloadedModelDirectory
        if FileManager.default.fileExists(atPath: dl.appendingPathComponent("model.safetensors").path),
           FileManager.default.fileExists(atPath: dl.appendingPathComponent("tokenizer.json").path) {
            return dl
        }
        return nil
    }

    init() {
        builtInInstalled = Self.localModelDirectory != nil
    }

    /// Apple's model when the iPhone has it, else the language's story-sense classifier. The
    /// on-demand Qwen3 0.6B language model only when downloaded and explicitly opted in.
    func choose(useBuiltIn: Bool = false, language: StoryLanguage = .english) {
        self.language = language
        builtInInstalled = Self.localModelDirectory != nil
        if useBuiltIn && Self.builtInAvailable { engine = .builtIn }
        else if Self.appleAvailable { engine = .apple }
        else if language.lexicon.storySenseClassifier && classifier(for: language) != nil { engine = .classifier }
        else { engine = .none }
    }

    private func classifier(for language: StoryLanguage) -> NLModel? {
        if let cached = classifiers[language] { return cached }
        let url = Bundle.main.url(forResource: "RoarlyDirector_\(language.rawValue)", withExtension: "mlmodelc")
            ?? (language == .english ? Bundle.main.url(forResource: "RoarlyDirector", withExtension: "mlmodelc") : nil)
        guard let url, let model = try? NLModel(contentsOf: url) else { return nil }
        classifiers[language] = model
        return model
    }

    /// Words the parent added for each sound (masked like the sound's own words).
    var customWords: [String: [String]] = [:]

    // MARK: - On-demand Qwen3-0.6B download

    func downloadBuiltInModel() {
        guard Self.builtInSupported, downloadTask == nil else { return }
        builtInError = nil
        builtInDownloadProgress = 0
        downloadTask = Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                self.builtInDownloadProgress = nil
                self.downloadTask = nil
            }
            do {
                try FileManager.default.createDirectory(at: Self.modelsRoot, withIntermediateDirectories: true)
                _ = try await MLXLMCommon.downloadModel(
                    hub: Self.hub,
                    configuration: ModelConfiguration(id: Self.modelID)
                ) { progress in
                    Task { @MainActor [weak self] in
                        self?.builtInDownloadProgress = progress.fractionCompleted
                    }
                }
                self.builtInInstalled = Self.localModelDirectory != nil
                log("on-demand model downloaded: \(Self.modelID)")
            } catch is CancellationError {
                log("on-demand model download cancelled")
            } catch {
                log("on-demand model download failed: \(error)")
                self.builtInError = "Couldn't download the model: \(error.localizedDescription)"
            }
        }
    }

    func cancelBuiltInDownload() {
        downloadTask?.cancel()
        downloadTask = nil
        builtInDownloadProgress = nil
    }

    func removeBuiltInModel() {
        cancelBuiltInDownload()
        unload()
        try? FileManager.default.removeItem(at: Self.downloadedModelDirectory)
        builtInInstalled = Self.localModelDirectory != nil
        builtInError = nil
        if engine == .builtIn && !builtInInstalled {
            choose(useBuiltIn: false, language: language)
        }
        log("on-demand model removed")
    }

    /// Loads the model before the story starts so the first question isn't slow.
    func warmUp() {
        switch engine {
        case .apple:
            LanguageModelSession(instructions: DirectorPrompt.instructions).prewarm()
        case .builtIn:
            Task { _ = try? await loadContainer() }
        case .classifier:
            // The classifier's BERT embeddings are an OS asset; fetch once if missing.
            let nlLang = NLLanguage(rawValue: language.lexicon.embeddingLanguage)
            if let e = NLContextualEmbedding(language: nlLang), !e.hasAvailableAssets {
                e.requestAssets { result, error in log("embedding assets (\(nlLang.rawValue)): \(result.rawValue) \(error?.localizedDescription ?? "")") }
            }
        case .none:
            break
        }
    }

    /// P(play) from the classifier, or nil.
    func classifierScore(_ review: StoryEngine.Review) -> Double? {
        guard let model = classifier(for: language) else { return nil }
        let text = DirectorPrompt.masked(review, language: language, customWords: customWords[review.cueID] ?? [])
        return model.predictedLabelHypotheses(for: text, maximumCount: 2)["play"]
    }

    /// Unloads the on-demand model (memory) when the story ends.
    func unload() {
        container = nil
        loading = nil
        #if !targetEnvironment(simulator)
        if engine == .builtIn { MLX.GPU.clearCache() }
        #endif
    }

    /// `true` play, `false` don't, `nil` no answer in time (or busy).
    func decide(_ review: StoryEngine.Review) async -> Bool? {
        guard engine != .none else { return nil }
        if engine == .classifier {
            let started = ContinuousClock.now
            let p = classifierScore(review)
            lastLatency = ContinuousClock.now - started
            log("director (story sense/\(language.rawValue), \(Self.milliseconds(lastLatency)) ms) \(review.cueID) P(play)=\(p.map { String(format: "%.2f", $0) } ?? "–")")
            guard let p else { return nil }
            // Between the two the parent decides: the card stays up.
            return p >= 0.6 ? true : (p <= 0.4 ? false : nil)
        }
        guard !busy else { return nil }
        busy = true
        defer { busy = false }
        let question = DirectorPrompt.question(for: review)
        let started = ContinuousClock.now
        let engine = self.engine
        let reply: String? = await withTaskGroup(of: String?.self) { group in
            group.addTask { @MainActor in
                do {
                    switch engine {
                    case .apple: return try await Self.askApple(question)
                    case .builtIn: return try await self.askBuiltIn(question)
                    case .none, .classifier: return nil
                    }
                } catch {
                    log("director error: \(error)")
                    return nil
                }
            }
            group.addTask {
                try? await Task.sleep(for: Self.timeLimit)
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
        lastLatency = ContinuousClock.now - started
        let verdict = reply.flatMap(DirectorPrompt.parse)
        log("director (\(engine.rawValue), \(Self.milliseconds(lastLatency)) ms) \(review.cueID) → \(reply?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "no answer")")
        return verdict
    }

    static func milliseconds(_ d: Duration?) -> Int {
        guard let d else { return -1 }
        return Int(d.components.seconds * 1000) + Int(d.components.attoseconds / 1_000_000_000_000_000)
    }

    private static func askApple(_ question: String) async throws -> String {
        let session = LanguageModelSession(instructions: DirectorPrompt.instructions)
        let response = try await session.respond(to: question, options: GenerationOptions(temperature: 0, maximumResponseTokens: 4))
        return response.content
    }

    private func askBuiltIn(_ question: String) async throws -> String {
        let container = try await loadContainer()
        let chat: [Chat.Message] = [.system(DirectorPrompt.instructions), .user(question)]
        // Qwen3 thinks out loud unless its chat template is told not to.
        let input = UserInput(chat: chat, additionalContext: ["enable_thinking": false])
        let parameters = GenerateParameters(maxTokens: 3, temperature: 0)
        return try await container.perform { (context: ModelContext) -> String in
            let lmInput = try await context.processor.prepare(input: input)
            var text = ""
            for await item in try MLXLMCommon.generate(input: lmInput, parameters: parameters, context: context) {
                if let chunk = item.chunk { text += chunk }
            }
            return text
        }
    }

    private func loadContainer() async throws -> ModelContainer {
        if let container { return container }
        if let loading { return try await loading.value }
        guard Self.builtInSupported, let dir = Self.localModelDirectory else {
            throw NSError(domain: "Roarly", code: 3, userInfo: [NSLocalizedDescriptionKey: "The on-demand model isn't downloaded yet."])
        }
        let task = Task<ModelContainer, Error> {
            MLX.GPU.set(cacheLimit: 64 * 1024 * 1024)
            return try await LLMModelFactory.shared.loadContainer(configuration: ModelConfiguration(directory: dir))
        }
        loading = task
        do {
            let c = try await task.value
            container = c
            loading = nil
            log("on-demand model loaded")
            return c
        } catch {
            loading = nil
            throw error
        }
    }
}
