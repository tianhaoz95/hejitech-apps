import Foundation
import FoundationModels
import MLX
import MLXLLM
import MLXLMCommon
import NaturalLanguage
import RoarlyKit

/// Settles the mentions the context rules aren't sure about ("the lion was quiet… the lion")
/// with a small on-device language model: Apple's where the iPhone has Apple Intelligence,
/// otherwise the bundled Qwen3 0.6B (MLX). One yes/no question, a few tokens, a hard time limit;
/// when the model is slow or missing the suggestion simply stays up for the parent to tap.
@MainActor
final class SmallModelDirector {
    enum Engine: String {
        case apple = "Apple Intelligence"
        /// Create ML text classifier trained on sentences written and labeled by Apple's model
        /// (ml/). 1.3 MB, milliseconds, every iPhone.
        case classifier = "Story sense"
        case builtIn = "Built-in language model"
        case none = "Off"
    }

    static let modelFolder = "Qwen3-0.6B-4bit"
    static let timeLimit: Duration = .milliseconds(2500)

    private(set) var engine: Engine = .none
    private(set) var lastLatency: Duration?
    private var container: ModelContainer?
    private var loading: Task<ModelContainer, Error>?
    private var busy = false

    static var appleAvailable: Bool { SystemLanguageModel.default.isAvailable }

    static var builtInAvailable: Bool {
        #if targetEnvironment(simulator)
        return false // MLX's Metal allocator can't run in the Simulator (it aborts the process).
        #else
        return Bundle.main.url(forResource: modelFolder, withExtension: nil) != nil
        #endif
    }

    /// Apple's model when the iPhone has it, else the story-sense classifier. The bundled 0.6B
    /// language model only when asked for: on evals/director_cases.json it answered at chance
    /// (11/22), Apple's model 18/22, the classifier 20/22 (and 96.9% on animals it never saw).
    /// The classifier was trained on one language (its lexicon says `storySenseClassifier`); other
    /// stories use Apple's model or leave unsure moments to the parent's tap.
    func choose(useBuiltIn: Bool = false, language: StoryLanguage = .english) {
        if useBuiltIn && Self.builtInAvailable { engine = .builtIn }
        else if Self.appleAvailable { engine = .apple }
        else if classifier != nil && language.lexicon.storySenseClassifier { engine = .classifier }
        else { engine = .none }
    }

    private lazy var classifier: NLModel? = {
        guard let url = Bundle.main.url(forResource: "RoarlyDirector", withExtension: "mlmodelc") else { return nil }
        return try? NLModel(contentsOf: url)
    }()

    /// Words the parent added for each sound (masked like the sound's own words).
    var customWords: [String: [String]] = [:]

    /// Loads the model before the story starts so the first question isn't slow.
    func warmUp() {
        switch engine {
        case .apple:
            LanguageModelSession(instructions: DirectorPrompt.instructions).prewarm()
        case .builtIn:
            Task { _ = try? await loadContainer() }
        case .classifier:
            // The classifier's BERT embeddings are an OS asset; fetch it once if missing.
            if let e = NLContextualEmbedding(language: .english), !e.hasAvailableAssets {
                e.requestAssets { result, error in log("embedding assets: \(result.rawValue) \(error?.localizedDescription ?? "")") }
            }
        case .none:
            break
        }
    }

    /// P(play) from the classifier, or nil.
    func classifierScore(_ review: StoryEngine.Review) -> Double? {
        guard let classifier else { return nil }
        let text = DirectorPrompt.masked(review, customWords: customWords[review.cueID] ?? [])
        return classifier.predictedLabelHypotheses(for: text, maximumCount: 2)["play"]
    }

    /// Unloads the bundled model (memory) when the story ends.
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
            log("director (story sense, \(Self.milliseconds(lastLatency)) ms) \(review.cueID) P(play)=\(p.map { String(format: "%.2f", $0) } ?? "–")")
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
        guard Self.builtInAvailable, let dir = Bundle.main.url(forResource: Self.modelFolder, withExtension: nil) else {
            throw NSError(domain: "Roarly", code: 3, userInfo: [NSLocalizedDescriptionKey: "The built-in model isn't available."])
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
            log("built-in model loaded")
            return c
        } catch {
            loading = nil
            throw error
        }
    }
}
