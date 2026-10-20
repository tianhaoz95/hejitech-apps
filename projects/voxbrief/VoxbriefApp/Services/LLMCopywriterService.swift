import Foundation
import os

/// Human-readable labels identifying which Stage 2 engine actually ran. Kept as plain strings
/// (rather than an enum with associated values) so `LLMProcessingResult`/`VoiceNote` stay
/// trivially `Codable` with no hand-written coding logic.
public enum CleanupEngineLabel {
    public static let notApplicable = "N/A"
    public static let ollama = "Ollama"
    /// Only on notes from builds before 1.26.6, which fell back to rule-based output.
    public static let ruleBased = "Rule-Based (LLM Unavailable)"
    public static let appleFoundationModel = "Apple Intelligence"

    public static func onDeviceLLM(model: String) -> String {
        "On-Device (\(model))"
    }

    /// The label to show for a stored engine string. Notes saved before the tier names existed
    /// carry the raw model names; this maps them so the UI never names a model.
    @MainActor
    public static func displayName(for label: String) -> String {
        label
            .replacingOccurrences(of: "On-Device LLM (", with: "On-Device (")
            .replacingOccurrences(of: "Apple Foundation Model", with: appleFoundationModel)
            .replacingOccurrences(of: "Qwen3-0.6B (bundled)", with: OnDeviceLLMService.smallModelDisplayName)
            .replacingOccurrences(of: "Qwen3-0.6B", with: OnDeviceLLMService.smallModelDisplayName)
            .replacingOccurrences(of: "Qwen3-4B", with: OnDeviceLLMService.largeModelDisplayName)
    }

    public static func ollama(model: String) -> String {
        "Ollama (\(model))"
    }
}

/// Which of the two Stage 2 rewrite styles to produce. Both run through the same engine chain
/// (Ollama -> on-device LLM -> rule-based fallback), just with a different prompt/transform:
/// `.full` restructures the transcript into requirements/conditions/action items (today's
/// behavior), while `.light` only fixes typos, grammar, and filler words, keeping the original
/// wording and sentence order intact.
public enum RewriteMode: Sendable {
    case full
    case light
}

/// Result produced by the Stage 2 on-device LLM cleanup and copywriting engine
public struct LLMProcessingResult: Sendable, Codable {
    public let title: String
    public let summary: String
    /// Legacy fields kept for backward compatibility (search, `NoteDetailView`'s pre-multi-
    /// template rendering path) -- for the `.full` mode's on-device/Ollama paths these are now
    /// derived from `sections` by matching the Design Doc template's fixed section titles, so
    /// they're only ever non-empty when that specific template was chosen. The legacy Ollama
    /// rewrite (`transformLocally`) always uses Design Doc, so these stay populated for it.
    public let requirements: [String]
    public let conditions: [String]
    public let actionItems: [String]
    public let cleanedMarkdown: String
    public let tags: [String]
    public let engine: String
    /// General-purpose structured content for whichever `NoteTemplate` was used -- empty for
    /// `.light` mode (no template concept) and for any caller not yet updated to pass templates.
    public let sections: [TemplateSectionContent]
    public let templateId: UUID?
    public let templateName: String
    /// The parts a long memo was read in (see `LLMCopywriterService.splitIntoParts`), empty when
    /// the transcript fit in one pass.
    public let parts: [LongMemoPart]
    /// How long each Stage 2 call took, in order (empty for the Ollama path).
    public let timings: [ProcessingTiming]

    public init(
        title: String,
        summary: String,
        requirements: [String],
        conditions: [String],
        actionItems: [String],
        cleanedMarkdown: String,
        tags: [String],
        engine: String,
        sections: [TemplateSectionContent] = [],
        templateId: UUID? = nil,
        templateName: String = "",
        parts: [LongMemoPart] = [],
        timings: [ProcessingTiming] = []
    ) {
        self.title = title
        self.summary = summary
        self.requirements = requirements
        self.conditions = conditions
        self.actionItems = actionItems
        self.cleanedMarkdown = cleanedMarkdown
        self.tags = tags
        self.engine = engine
        self.sections = sections
        self.templateId = templateId
        self.templateName = templateName
        self.parts = parts
        self.timings = timings
    }
}

public protocol LLMCopywriterServiceProtocol: Sendable {
    /// `dictionary` is the user's personal jargon/proper-noun list (see `DictionaryEntry`),
    /// injected into the LLM prompt as terms to preserve verbatim. Pass `[]` for none.
    /// `templates` is the available set of output templates (built-in + user-defined, see
    /// `NoteTemplate`/`TemplateStore`) the LLM picks from for `.full` mode -- ignored by `.light`
    /// mode, and treated as `NoteTemplate.builtIns` if passed empty. A single template skips
    /// classification and is used as-is (how a user's template change is applied).
    /// Throws `LLMCopywriterError.aiEngineUnavailable` when no AI engine can run: there is no
    /// rule-based fallback, the caller keeps the raw transcript instead.
    func processTranscript(_ rawTranscript: String, mode: RewriteMode, dictionary: [DictionaryEntry], templates: [NoteTemplate]) async throws -> LLMProcessingResult

    /// Best-effort: starts loading whichever engine would actually serve the next call now,
    /// rather than paying that cost inline on first real use. A no-op is a valid, always-safe
    /// implementation (e.g. for a test double, or when routed to Ollama/ineligible for on-device).
    /// See `NoteProcessingPipeline.warmUp`.
    func warmUp() async
}

public enum LLMCopywriterError: LocalizedError {
    case unparsableResponse
    case aiEngineUnavailable

    public var errorDescription: String? {
        switch self {
        case .unparsableResponse:
            return "On-device model response could not be parsed as JSON."
        case .aiEngineUnavailable:
            return "AI engine not available. Your transcript is saved in the Transcript tab."
        }
    }
}

public final class LLMCopywriterService: LLMCopywriterServiceProtocol, @unchecked Sendable {
    public static let shared = LLMCopywriterService()

    public static let defaultLocalLLMModelName = "llama3.2:1b"
    public static let localLLMModelNameKey = "local_llm_model_name"

    public static func configuredLocalLLMModelName() -> String {
        let stored = UserDefaults.standard.string(forKey: localLLMModelNameKey)?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let stored, !stored.isEmpty {
            return stored
        }
        return defaultLocalLLMModelName
    }
    
    public init() {}

    /// Best-effort: warms the on-device model (see `OnDeviceLLMService.warmUp`) so a call already
    /// in flight by the time `processTranscript` actually runs doesn't pay a cold-load cost. A
    /// no-op when routed to the Ollama endpoint instead (nothing on-device to warm) or when
    /// on-device models aren't supported on this device (e.g. the Simulator).
    public func warmUp() async {
        guard !UserDefaults.standard.bool(forKey: "use_local_llm_endpoint") else { return }
        if await OnDeviceLLMService.shared.isUsingAppleFoundationModel { return }
        await OnDeviceLLMService.shared.warmUp()
    }

    /// Processes a raw speech transcript through Stage 2 LLM cleanup and copywriting.
    /// `mode` defaults to `.full`, `dictionary`/`templates` default to `[]` (today's behavior,
    /// plus "use the built-in templates" for `templates`) so existing call sites on the concrete
    /// type don't need to change; callers through `LLMCopywriterServiceProtocol` must pass all
    /// three explicitly since protocol requirements can't carry default argument values.
    public func processTranscript(_ rawTranscript: String, mode: RewriteMode = .full, dictionary: [DictionaryEntry] = [], templates: [NoteTemplate] = []) async throws -> LLMProcessingResult {
        let stripped = stripASRSpecialTokens(rawTranscript)
        let commands = VoiceCommandProcessor.process(stripped)
        let trimmed = commands.cleanedTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return LLMProcessingResult(
                title: "Empty Note",
                summary: "No speech content detected.",
                requirements: [],
                conditions: [],
                actionItems: [],
                cleanedMarkdown: "_No content recorded._",
                tags: [],
                engine: CleanupEngineLabel.notApplicable
            )
        }

        let baseResult: LLMProcessingResult = try await {
            // 1. Optional external endpoint (e.g. Ollama running a bigger model at home) -- opt-in,
            //    off by default, for users who want to trade on-device-only for more horsepower.
            if UserDefaults.standard.bool(forKey: "use_local_llm_endpoint"),
               let endpointString = UserDefaults.standard.string(forKey: "local_llm_endpoint_url"),
               let endpointURL = URL(string: endpointString) {
                let modelName = Self.configuredLocalLLMModelName()
                do {
                    return try await callLocalLLMEndpoint(url: endpointURL, model: modelName, transcript: trimmed, mode: mode, dictionary: dictionary, templates: templates)
                } catch {
                    print("[LLMCopywriterService] Local LLM endpoint failed, falling back: \(error)")
                }
            }

            // 2. Apple Intelligence, the default where the device supports it.
            if await OnDeviceLLMService.shared.isUsingAppleFoundationModel {
                do {
                    return try await processWithAppleFoundationModel(transcript: trimmed, mode: mode, dictionary: dictionary, templates: templates)
                } catch {
                    print("[LLMCopywriterService] Apple Foundation Model failed, falling back: \(error)")
                }
            }

            // 3. MLX: Flash when it's the one in use, otherwise the bundled Lite -- the user's pick,
            //    and the fallback wherever Apple Intelligence isn't available or failed.
            do {
                return try await processWithOnDeviceLLM(transcript: trimmed, mode: mode, dictionary: dictionary, templates: templates)
            } catch {
                print("[LLMCopywriterService] On-device MLX model failed: \(error)")
            }

            // 4. No rule-based fallback: its output was rarely worth reading over the raw
            //    transcript, which the caller keeps.
            throw LLMCopywriterError.aiEngineUnavailable
        }()

        return applyVoiceCommands(to: baseResult, commands: commands)
    }

    private func applyVoiceCommands(to result: LLMProcessingResult, commands: ProcessedVoiceCommands) -> LLMProcessingResult {
        var title = result.title
        if let explicit = commands.explicitTitle, !explicit.isEmpty {
            title = explicit
        }
        var actions = result.actionItems
        for item in commands.extractedActionItems {
            if !actions.contains(item) {
                actions.append(item)
            }
        }
        return LLMProcessingResult(
            title: title,
            summary: result.summary,
            requirements: result.requirements,
            conditions: result.conditions,
            actionItems: actions,
            cleanedMarkdown: result.cleanedMarkdown,
            tags: result.tags,
            engine: result.engine,
            sections: result.sections,
            templateId: result.templateId,
            templateName: result.templateName,
            parts: result.parts,
            timings: result.timings
        )
    }

    // MARK: - On-Device LLM (MLX Swift + Qwen3)

    private struct OnDeviceLLMLightJSONResult: Decodable {
        var title: String?
        var summary: String?
        var cleanedText: String?
        var tags: [String]?
    }

    private func processWithOnDeviceLLM(transcript: String, mode: RewriteMode, dictionary: [DictionaryEntry], templates: [NoteTemplate]) async throws -> LLMProcessingResult {
        let engine = StageTwoEngine(label: CleanupEngineLabel.onDeviceLLM(model: await OnDeviceLLMService.shared.mlxModelDisplayName)) { system, user, maxTokens in
            try await OnDeviceLLMService.shared.generate(systemPrompt: system, userPrompt: user, maxTokens: maxTokens)
        }
        return try await process(transcript: transcript, mode: mode, dictionary: dictionary, templates: templates, engine: engine)
    }

    /// The on-device engines Stage 2 uses, in the order `processTranscript` tries them: Apple
    /// Intelligence where it's the one in use, then MLX (Flash or Lite). Ask Voxbrief answers
    /// with these, so questions go to the same model that writes the notes.
    func onDeviceEngines() async -> [StageTwoEngine] {
        var engines: [StageTwoEngine] = []
        if await OnDeviceLLMService.shared.isUsingAppleFoundationModel {
            engines.append(StageTwoEngine(label: CleanupEngineLabel.appleFoundationModel) { system, user, _ in
                try await AppleFoundationModelService.shared.generate(systemPrompt: system, userPrompt: user)
            })
        }
        engines.append(StageTwoEngine(label: CleanupEngineLabel.onDeviceLLM(model: await OnDeviceLLMService.shared.mlxModelDisplayName)) { system, user, maxTokens in
            try await OnDeviceLLMService.shared.generate(systemPrompt: system, userPrompt: user, maxTokens: maxTokens)
        })
        return engines
    }

    /// `extractJSONObject` for callers outside this type (Ask Voxbrief's answer parsing).
    static func jsonObjectSubstring(in text: String) -> String? {
        extractJSONObject(from: text)
    }

    // MARK: - Engine-independent Stage 2 (Apple Intelligence and MLX share it)

    /// One Stage 2 engine's raw text generation plus the label stored on the note. Apple
    /// Intelligence ignores `maxTokens` (its session manages the answer length itself).
    struct StageTwoEngine: Sendable {
        let label: String
        let generate: @Sendable (_ system: String, _ user: String, _ maxTokens: Int) async throws -> String
    }

    /// A long transcript is read in parts once it passes this many words. Apple Intelligence's
    /// context is 4,096 tokens for prompt and answer together, so a 1,500-word transcript (about
    /// 2,000 tokens) plus the system prompt and a full answer is about all that fits; longer ones
    /// used to throw there and land on Lite with the whole transcript. Measured in words, not
    /// tokens, because no tokenizer is shared by every engine; English runs ~1.35 tokens a word.
    static let longTranscriptWordThreshold = 1500
    /// Target words per part for the full rewrite (~1,350 tokens in, room for a 1,024-token answer).
    static let longMemoPartWordTarget = 1000
    /// The light rewrite answers with the whole text again, so its parts are smaller.
    static let lightTranscriptWordThreshold = 700
    static let lightPartWordTarget = 600
    /// Answer budget for one light pass: the corrected text is about as long as its input.
    static let lightMaxTokens = 1536

    /// One slice of a transcript read on its own, with where its own (non-overlap) text starts
    /// as a fraction of the transcript's words.
    struct TranscriptPart: Equatable, Sendable {
        let text: String
        let startFraction: Double
    }

    /// `internal` so tests can drive it with a scripted engine.
    func process(transcript: String, mode: RewriteMode, dictionary: [DictionaryEntry], templates: [NoteTemplate], engine: StageTwoEngine) async throws -> LLMProcessingResult {
        switch mode {
        case .full:
            let parts = Self.splitIntoParts(transcript, threshold: Self.longTranscriptWordThreshold, target: Self.longMemoPartWordTarget, overlap: true)
            if parts.count > 1 {
                return try await processLongFull(parts: parts, transcript: transcript, dictionary: dictionary, templates: templates, engine: engine)
            }
            return try await processFull(transcript: transcript, dictionary: dictionary, templates: templates, engine: engine)
        case .light:
            // No overlap: the parts' corrected texts are joined back into one text.
            let parts = Self.splitIntoParts(transcript, threshold: Self.lightTranscriptWordThreshold, target: Self.lightPartWordTarget, overlap: false)
            if parts.count > 1 {
                return try await processLongLight(parts: parts, transcript: transcript, dictionary: dictionary, engine: engine)
            }
            return try await processLight(transcript: transcript, dictionary: dictionary, engine: engine)
        }
    }

    private static let signposter = OSSignposter(subsystem: "com.jacksonzhou666.voxbrief", category: "Stage2")

    /// Runs one engine call, timing it (and marking it for Instruments' Points of Interest).
    private func measured(_ name: String, into timings: inout [ProcessingTiming], _ call: () async throws -> String) async throws -> String {
        let state = Self.signposter.beginInterval("Stage2Call", "\(name, privacy: .public)")
        let start = ContinuousClock.now
        defer { Self.signposter.endInterval("Stage2Call", state) }
        let result = try await call()
        let elapsed = ContinuousClock.now - start
        timings.append(ProcessingTiming(name: name, seconds: Double(elapsed.components.seconds) + Double(elapsed.components.attoseconds) / 1e18))
        return result
    }

    /// Words of the transcript the template classification reads. Telling a meeting from a to-do
    /// list takes the opening, not the whole memo, and the classification prompt is a full
    /// prefill of whatever it's given, so a long memo used to pay for reading itself twice.
    static let classificationInputWords = 400

    /// The transcript as the classification call sees it: its first `classificationInputWords`
    /// words (all of it when shorter). `internal` for tests and the prompt export.
    func classificationInput(_ transcript: String) -> String {
        let words = transcript.split(whereSeparator: \.isWhitespace)
        guard words.count > Self.classificationInputWords else { return transcript }
        return words.prefix(Self.classificationInputWords).joined(separator: " ") + " …"
    }

    /// Picks the template: the only one there is, or a short classification call. A long memo
    /// is classified on its first part, which is plenty to tell a meeting from a to-do list.
    private func chooseTemplate(for transcript: String, templates: [NoteTemplate], engine: StageTwoEngine, timings: inout [ProcessingTiming]) async throws -> NoteTemplate {
        let availableTemplates = templates.isEmpty ? NoteTemplate.builtIns : templates
        if let only = Self.singleTemplate(in: availableTemplates) {
            return only
        }
        let classificationRaw = try await measured("Pick template", into: &timings) {
            try await engine.generate(buildClassificationSystemPrompt(templates: availableTemplates), classificationInput(transcript), 24)
        }
        return resolveTemplate(fromClassificationRaw: classificationRaw, candidates: availableTemplates, fallback: effectiveFallbackTemplate(in: availableTemplates))
    }

    /// Two calls instead of one: first classify which template best fits this transcript (a
    /// short completion), then generate content using only that one template's schema.
    /// Deliberately not a single combined prompt: asking a small on-device model to hold every
    /// template's schema in context simultaneously and self-select is exactly the kind of
    /// capacity strain multi-template support needs to avoid.
    private func processFull(transcript: String, dictionary: [DictionaryEntry], templates: [NoteTemplate], engine: StageTwoEngine) async throws -> LLMProcessingResult {
        var timings: [ProcessingTiming] = []
        let chosenTemplate = try await chooseTemplate(for: transcript, templates: templates, engine: engine, timings: &timings)

        let generationRaw = try await measured("Write note", into: &timings) {
            try await engine.generate(
                buildGenerationSystemPrompt(template: chosenTemplate, dictionary: dictionary),
                transcriptUserPrompt(transcript, dictionary: dictionary),
                1024
            )
        }
        let parsed = try parseGenerationResponse(generationRaw, template: chosenTemplate)

        let title: String
        if let candidate = parsed.title?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty {
            title = candidate
        } else {
            title = generateTitle(from: splitIntoSentences(sanitizeSpeechTranscript(transcript)), raw: transcript)
        }

        let summary: String
        if let candidate = parsed.summary?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty {
            summary = candidate
        } else {
            summary = "Voice memo captured and structured on-device."
        }

        let tags = (parsed.tags?.isEmpty == false) ? parsed.tags! : extractTags(from: transcript)
        let (requirements, conditions, actionItems) = Self.legacyFields(from: parsed.sections)
        let markdown = assembleMarkdown(title: title, summary: summary, sections: parsed.sections)

        return LLMProcessingResult(
            title: title,
            summary: summary,
            requirements: requirements,
            conditions: conditions,
            actionItems: actionItems,
            cleanedMarkdown: markdown,
            tags: tags,
            engine: engine.label,
            sections: parsed.sections,
            templateId: chosenTemplate.id,
            templateName: chosenTemplate.name,
            timings: timings
        )
    }

    /// A long memo, read in parts: every part goes through the same generation prompt (so each
    /// answer fits the engine's context), the parts' sections are merged and de-duplicated, and
    /// one short call titles and summarises the whole memo from the parts' summaries and points.
    /// A part whose answer can't be parsed is skipped rather than failing the memo; the memo
    /// fails only when no part could be read.
    private func processLongFull(parts: [TranscriptPart], transcript: String, dictionary: [DictionaryEntry], templates: [NoteTemplate], engine: StageTwoEngine) async throws -> LLMProcessingResult {
        var timings: [ProcessingTiming] = []
        let chosenTemplate = try await chooseTemplate(for: parts[0].text, templates: templates, engine: engine, timings: &timings)
        let systemPrompt = buildGenerationSystemPrompt(template: chosenTemplate, dictionary: dictionary)

        var readParts: [(part: TranscriptPart, parsed: (title: String?, summary: String?, tags: [String]?, sections: [TemplateSectionContent]))] = []
        for (index, part) in parts.enumerated() {
            try Task.checkCancellation()
            do {
                let raw = try await measured("Part \(index + 1) of \(parts.count)", into: &timings) {
                    try await engine.generate(systemPrompt, longMemoPartUserPrompt(part.text, index: index, count: parts.count, dictionary: dictionary), 1024)
                }
                readParts.append((part, try parseGenerationResponse(raw, template: chosenTemplate)))
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                print("[LLMCopywriterService] Long memo part \(index + 1)/\(parts.count) failed: \(error)")
            }
        }
        guard !readParts.isEmpty else { throw LLMCopywriterError.unparsableResponse }

        let sections = Self.mergePartSections(readParts.map(\.parsed.sections))
        let partSummaries = readParts.map { $0.parsed.summary?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" }

        var overview: GenerationUniversalFields?
        do {
            let raw = try await measured("Overview", into: &timings) {
                try await engine.generate(
                    buildLongMemoOverviewSystemPrompt(dictionary: dictionary),
                    longMemoOverviewUserPrompt(partSummaries: partSummaries, sections: sections),
                    256
                )
            }
            if let json = Self.extractJSONObject(from: raw) {
                overview = try? JSONDecoder().decode(GenerationUniversalFields.self, from: Data(json.utf8))
            }
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            print("[LLMCopywriterService] Long memo overview failed, using the parts' own: \(error)")
        }

        let firstPartTitle = readParts.lazy.compactMap { $0.parsed.title?.trimmingCharacters(in: .whitespacesAndNewlines) }.first { !$0.isEmpty }
        let title = Self.nonEmpty(overview?.title)
            ?? firstPartTitle
            ?? generateTitle(from: splitIntoSentences(sanitizeSpeechTranscript(transcript)), raw: transcript)
        let summary = Self.nonEmpty(overview?.summary)
            ?? Self.nonEmpty(partSummaries.filter { !$0.isEmpty }.prefix(2).joined(separator: " "))
            ?? "Long voice memo captured and structured on-device."
        let tags = (overview?.tags?.isEmpty == false) ? overview!.tags! : Self.mergedTags(readParts.map { $0.parsed.tags ?? [] })

        let (requirements, conditions, actionItems) = Self.legacyFields(from: sections)
        return LLMProcessingResult(
            title: title,
            summary: summary,
            requirements: requirements,
            conditions: conditions,
            actionItems: actionItems,
            cleanedMarkdown: assembleMarkdown(title: title, summary: summary, sections: sections),
            tags: tags.isEmpty ? extractTags(from: transcript) : tags,
            engine: engine.label,
            sections: sections,
            templateId: chosenTemplate.id,
            templateName: chosenTemplate.name,
            parts: readParts.map { LongMemoPart(startFraction: $0.part.startFraction, summary: $0.parsed.summary ?? "") },
            timings: timings
        )
    }

    private static func nonEmpty(_ text: String?) -> String? {
        guard let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
        return trimmed
    }

    /// Splits a transcript into parts of about `target` words on sentence boundaries, or returns
    /// it as one part when it has `threshold` words or fewer. A sentence longer than a part (an
    /// unpunctuated transcript is one "sentence") is cut into word windows. With `overlap`, each
    /// part after the first repeats the previous part's last sentence, so a point spoken across
    /// the cut isn't lost. A short tail is folded into the part before it. `internal` for tests.
    static func splitIntoParts(_ transcript: String, threshold: Int, target: Int, overlap: Bool) -> [TranscriptPart] {
        let totalWords = transcript.split(whereSeparator: \.isWhitespace).count
        guard totalWords > threshold, target > 0 else {
            return [TranscriptPart(text: transcript, startFraction: 0)]
        }

        var sentences: [[Substring]] = []
        transcript.enumerateSubstrings(in: transcript.startIndex..<transcript.endIndex, options: [.bySentences]) { substring, _, _, _ in
            guard let substring else { return }
            let words = substring.split(whereSeparator: \.isWhitespace)
            guard !words.isEmpty else { return }
            stride(from: 0, to: words.count, by: target).forEach { start in
                sentences.append(Array(words[start..<min(start + target, words.count)]))
            }
        }

        // Group sentences into parts: (first sentence index, sentence count).
        var groups: [(start: Int, count: Int, words: Int)] = []
        var start = 0, count = 0, words = 0
        for (index, sentence) in sentences.enumerated() {
            if count > 0 && words + sentence.count > target {
                groups.append((start, count, words))
                start = index; count = 0; words = 0
            }
            count += 1
            words += sentence.count
        }
        if count > 0 { groups.append((start, count, words)) }
        if groups.count > 1, let last = groups.last, last.words < target / 3 {
            groups.removeLast()
            groups[groups.count - 1].count += last.count
            groups[groups.count - 1].words += last.words
        }

        var wordsBefore = 0
        return groups.map { group in
            var slice = Array(sentences[group.start..<(group.start + group.count)])
            if overlap, group.start > 0 {
                slice.insert(sentences[group.start - 1], at: 0)
            }
            let part = TranscriptPart(
                text: slice.map { $0.joined(separator: " ") }.joined(separator: " "),
                startFraction: Double(wordsBefore) / Double(totalWords)
            )
            wordsBefore += group.words
            return part
        }
    }

    /// Merges the parts' sections (all from the same template, so index-aligned): items are
    /// concatenated in order, dropping ones that repeat an earlier item (same words, or 80% of
    /// the same words, which is how the overlap sentence usually comes back). `internal` for tests.
    static func mergePartSections(_ partSections: [[TemplateSectionContent]]) -> [TemplateSectionContent] {
        guard let first = partSections.first else { return [] }
        return first.indices.map { index in
            var items: [String] = []
            var seen: [Set<String>] = []
            for sections in partSections where index < sections.count {
                for item in sections[index].items {
                    let words = Self.comparisonWords(item)
                    guard !words.isEmpty else { continue }
                    let repeats = seen.contains { other in
                        let shared = Double(words.intersection(other).count)
                        return shared / Double(max(words.count, other.count)) >= 0.8
                    }
                    if !repeats {
                        items.append(item)
                        seen.append(words)
                    }
                }
            }
            return TemplateSectionContent(title: first[index].title, style: first[index].style, items: items)
        }
    }

    private static func comparisonWords(_ text: String) -> Set<String> {
        Set(text.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init))
    }

    /// Union of the parts' tags, most frequent first, at most six.
    static func mergedTags(_ partTags: [[String]]) -> [String] {
        var counts: [String: (count: Int, firstSeen: Int, spelling: String)] = [:]
        var order = 0
        for tags in partTags {
            for tag in tags {
                let key = tag.lowercased()
                if let existing = counts[key] {
                    counts[key] = (existing.count + 1, existing.firstSeen, existing.spelling)
                } else {
                    counts[key] = (1, order, tag)
                    order += 1
                }
            }
        }
        return counts.values
            .sorted { $0.count != $1.count ? $0.count > $1.count : $0.firstSeen < $1.firstSeen }
            .prefix(6)
            .map(\.spelling)
    }

    /// The user message for one part of a long memo: which part it is, so the model extracts
    /// only what this part says instead of inventing a whole-memo framing. `internal` for tests.
    func longMemoPartUserPrompt(_ text: String, index: Int, count: Int, dictionary: [DictionaryEntry]) -> String {
        "This is part \(index + 1) of \(count) of one long voice memo. Extract only what this part says; "
            + "the other parts are handled separately.\n\n" + transcriptUserPrompt(text, dictionary: dictionary)
    }

    /// System prompt for the last call on a long memo: title, summary and tags for the whole memo
    /// from its parts' summaries and merged points. `internal` for tests.
    func buildLongMemoOverviewSystemPrompt(dictionary: [DictionaryEntry]) -> String {
        """
        You write the title and summary of one long voice memo. You are given a one-sentence \
        summary of each of its parts, in order, and the key points taken from them. Respond with \
        ONLY one valid JSON object -- no markdown code fences, no commentary before or after -- \
        using exactly these keys: "title" (string, 8 words or fewer, about the whole memo), \
        "summary" (one or two sentences covering the whole memo, not just its start), "tags" \
        (array of short hashtags starting with #).\(dictionaryInstructionBlock(dictionary))
        """
    }

    /// At most 30 points, so the overview prompt stays small whatever the memo's length.
    func longMemoOverviewUserPrompt(partSummaries: [String], sections: [TemplateSectionContent]) -> String {
        let summaries = partSummaries.enumerated()
            .filter { !$0.element.isEmpty }
            .map { "\($0.offset + 1). \($0.element)" }
            .joined(separator: "\n")
        let points = sections.flatMap { section in section.items.map { "- \(section.title): \($0)" } }
            .prefix(30)
            .joined(separator: "\n")
        return "Part summaries:\n\(summaries)\n\nKey points:\n\(points)"
    }

    // MARK: - Multi-template classification & generation

    private struct TemplateClassificationJSON: Decodable {
        var template: String?
    }

    private struct GenerationUniversalFields: Decodable {
        var title: String?
        var summary: String?
        var tags: [String]?
    }

    /// Fixed transcript -> template-name example pairs used as few-shot examples in the
    /// classification prompt (see below). A small model follows worked examples far more
    /// reliably than free-form descriptions alone -- this was added after real-device testing
    /// showed a casually-phrased todo list ("I need to finish X, read Y, prepare Z...") still
    /// got classified as General Notes even with a good description-only prompt, because that
    /// phrasing also superficially resembles Design Doc's "requirements" language. Only ever
    /// referenced by name (never by index), so a template being renamed/removed just drops its
    /// example rather than breaking anything. `internal` for direct unit testing.
    static let classificationFewShotExamples: [(transcript: String, templateName: String)] = [
        ("I need to call the dentist, buy groceries, and finish my taxes.", "Task List"),
        ("So tomorrow I need to finish the report, read through the contract, and call the client back about the invoice.", "Task List"),
        ("Write an email to Sarah telling her the report is delayed until Friday.", "Email"),
        ("Draft a tweet announcing we just launched our new feature.", "Short Tweet"),
        ("The system must support two factor authentication. If a user fails twice, lock the account. Then follow up with the security team.", "Design Doc"),
        ("I've been thinking about how we could redesign the onboarding flow, there's a few interesting directions.", "General Notes")
    ]

    /// The template `resolveTemplate` should fall back to for a given candidate set: the global
    /// default (General Notes) if it's actually in `templates`, otherwise the first available
    /// template. Needed because `templates` may be a strict subset the user has enabled via
    /// `TemplateStore.setEnabled` -- if General Notes itself was disabled, falling back to it
    /// anyway would silently resurrect a template the user turned off. `internal` for direct
    /// unit testing.
    /// The template to use without classifying, when there is only one to choose from (a
    /// template the user picked for a note, or a single enabled template).
    static func singleTemplate(in templates: [NoteTemplate]) -> NoteTemplate? {
        templates.count == 1 ? templates[0] : nil
    }

    func effectiveFallbackTemplate(in templates: [NoteTemplate]) -> NoteTemplate {
        templates.first(where: { $0.id == NoteTemplate.fallbackDefault.id })
            ?? templates.first
            ?? NoteTemplate.fallbackDefault
    }

    /// Builds the system prompt for step A (classify): lists every available template's name and
    /// summary, asks for only `{"template": "<exact name>"}` in response -- a short, single-
    /// purpose completion, deliberately simpler than asking the model to also generate content
    /// in the same call. `internal` (not `private`) so it's directly unit-testable, matching
    /// `dictionaryInstructionBlock`'s existing precedent.
    func buildClassificationSystemPrompt(templates: [NoteTemplate]) -> String {
        let listing = templates.map { "- \"\($0.name)\": \($0.summary)" }.joined(separator: "\n")
        let fallbackName = effectiveFallbackTemplate(in: templates).name

        let availableNames = Set(templates.map(\.name))
        let examples = Self.classificationFewShotExamples.filter { availableNames.contains($0.templateName) }
        let exampleBlock = examples.isEmpty ? "" : "\n\nExamples:\n" + examples.map {
            "Transcript: \"\($0.transcript)\"\nAnswer: {\"template\": \"\($0.templateName)\"}"
        }.joined(separator: "\n") + "\n"

        return """
        You choose which note-taking template best fits a spoken voice-memo transcript. Pick the \
        single most specific template that matches -- do not default to "\(fallbackName)" just \
        because you're unsure. Several distinct short to-dos are a task list even when spoken as \
        one flowing sentence joined by "and" rather than a comma list, e.g. "I need to finish X, \
        read Y, and prepare Z" -- count the separate things being done; if there are two or more, \
        it's a task list, not general notes. Reserve "\(fallbackName)" for open-ended musing with \
        no separate countable items. Available templates:
        \(listing)
        Only choose "\(fallbackName)" if the transcript truly matches none of the more specific \
        templates above.\(exampleBlock)
        Respond with ONLY one valid JSON object -- no markdown code fences, no commentary before \
        or after -- using exactly this key: "template" (string, the exact name of the best-fitting \
        template from the list above).
        """
    }

    /// Resolves step A's raw model output into one of `candidates`, falling back to `fallback` if
    /// the response can't be parsed or doesn't match any known template by name (case-
    /// insensitive). `internal` for direct unit testing, no LLM call involved.
    func resolveTemplate(fromClassificationRaw raw: String, candidates: [NoteTemplate], fallback: NoteTemplate) -> NoteTemplate {
        guard let jsonSubstring = Self.extractJSONObject(from: raw),
              let decoded = try? JSONDecoder().decode(TemplateClassificationJSON.self, from: Data(jsonSubstring.utf8)),
              let name = decoded.template?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty else {
            return fallback
        }
        return candidates.first(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame }) ?? fallback
    }

    /// Builds the system prompt for step B (generate): universal `title`/`summary`/`tags` keys
    /// always present, plus one key per `template.sections` (keyed by `fieldKey`, guided by
    /// `instructions`) -- a direct generalization of what used to be a hardcoded 4-key prompt.
    /// `internal` for direct unit testing.
    func buildGenerationSystemPrompt(template: NoteTemplate, dictionary: [DictionaryEntry]) -> String {
        let sectionLines = template.sections.map { section -> String in
            let trimmedInstructions = section.instructions.trimmingCharacters(in: .whitespacesAndNewlines)
            let instructions = trimmedInstructions.isEmpty ? "Free-form content relevant to this section." : trimmedInstructions
            switch section.style {
            case .paragraph:
                return "\"\(section.fieldKey)\" (string: \(instructions))"
            case .bullet, .numbered, .checklist:
                return "\"\(section.fieldKey)\" (array of strings: \(instructions))"
            }
        }.joined(separator: ", ")

        return """
        You convert a rough spoken voice-memo transcript into structured notes using the \
        "\(template.name)" format. Respond with ONLY one valid JSON object -- no markdown code \
        fences, no commentary before or after -- using exactly these keys: "title" (string, 8 \
        words or fewer), "summary" (one sentence string), \(sectionLines), "tags" (array of short \
        hashtags starting with #). Use an empty array or empty string for any category with \
        nothing to report. Fix grammar and remove filler words in every \
        string.\(dictionaryInstructionBlock(dictionary))
        """
    }

    /// System prompt for the `.light` proofread (Apple Intelligence and MLX). `internal` for
    /// unit tests and the prompt export the LLM eval reads (`evals/llm`).
    func buildLightSystemPrompt(dictionary: [DictionaryEntry]) -> String {
        // `cleanedText` comes first: asked for a summary first, the small model wrote one and then
        // copied it into `cleanedText`, dropping sentences (the eval's light cases failed on lost
        // content). No worked example: Lite copied an example answer verbatim on longer inputs.
        """
        You lightly proofread a rough spoken voice-memo transcript. Keep every sentence and every \
        piece of content, in the original order and wording: do not summarize, merge, shorten or \
        restructure into lists. Only fix typos, grammar and obvious speech-to-text errors, and \
        delete filler words (um, uh, you know, like, sort of, kind of, basically) and the commas \
        around them. Also delete bracketed non-speech tags the speech recognizer inserted, such as \
        [Laughter], [Music], [Inaudible Remark] or [BLANK_AUDIO]. Respond with ONLY one valid JSON \
        object -- no markdown code fences, no commentary before or after -- using exactly these \
        keys, in this order: "cleanedText" (string, the full lightly-corrected transcript, sentence \
        by sentence, with as many sentences as the transcript), "title" (a short topic label of 2 \
        to 6 words, not a sentence from the transcript), "summary" (one sentence string), "tags" \
        (array of short hashtags starting with #).\(dictionaryInstructionBlock(dictionary))
        """
    }

    /// Parses step B's raw model output. Universal fields decode via a small `Decodable` type,
    /// but each template section's own field can't (its key isn't known at compile time), so
    /// this reads the same JSON via `JSONSerialization` instead and looks each one up by
    /// `fieldKey` -- the same style `callLocalLLMEndpoint` already uses for its own request/
    /// response handling, so no new decoding idiom is introduced. Accepts either an array of
    /// strings or a bare string per section (a small model may emit either shape for what's
    /// conceptually "one blob of prose" in a `.paragraph`-style section). Throws only if the
    /// outer JSON object itself can't be extracted at all; a missing/malformed individual
    /// section degrades to an empty array rather than failing the whole response. `internal`
    /// for direct unit testing.
    func parseGenerationResponse(_ raw: String, template: NoteTemplate) throws -> (title: String?, summary: String?, tags: [String]?, sections: [TemplateSectionContent]) {
        guard let jsonSubstring = Self.extractJSONObject(from: raw) else {
            throw LLMCopywriterError.unparsableResponse
        }
        let jsonData = Data(jsonSubstring.utf8)
        let universal = try? JSONDecoder().decode(GenerationUniversalFields.self, from: jsonData)
        let rawObject = (try? JSONSerialization.jsonObject(with: jsonData)) as? [String: Any]

        let sections: [TemplateSectionContent] = template.sections.map { section in
            let items: [String]
            switch rawObject?[section.fieldKey] {
            case let array as [String]:
                items = array
            case let text as String:
                let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                items = trimmed.isEmpty ? [] : [trimmed]
            default:
                items = []
            }
            return TemplateSectionContent(title: section.title, style: section.style, items: items)
        }

        return (universal?.title, universal?.summary, universal?.tags, sections)
    }

    /// Derives the legacy `requirements`/`conditions`/`actionItems` arrays from a generic
    /// `sections` array, by matching the Design Doc built-in template's fixed section titles --
    /// works automatically whenever that template was chosen (built-in templates can't be
    /// renamed, so this match is reliable), and correctly comes back empty for every other
    /// template. `internal` for direct unit testing.
    static func legacyFields(from sections: [TemplateSectionContent]) -> (requirements: [String], conditions: [String], actionItems: [String]) {
        let requirements = sections.first(where: { $0.title == NoteTemplate.designDoc.sections[0].title })?.items ?? []
        let conditions = sections.first(where: { $0.title == NoteTemplate.designDoc.sections[1].title })?.items ?? []
        let actionItems = sections.first(where: { $0.title == NoteTemplate.designDoc.sections[2].title })?.items
            ?? sections.first(where: { $0.style == .checklist })?.items
            ?? []
        return (requirements, conditions, actionItems)
    }

    private func processLight(transcript: String, dictionary: [DictionaryEntry], engine: StageTwoEngine) async throws -> LLMProcessingResult {
        let raw = try await engine.generate(buildLightSystemPrompt(dictionary: dictionary), transcriptUserPrompt(transcript, dictionary: dictionary), Self.lightMaxTokens)

        guard let jsonSubstring = Self.extractJSONObject(from: raw) else {
            throw LLMCopywriterError.unparsableResponse
        }
        let decoded = try JSONDecoder().decode(OnDeviceLLMLightJSONResult.self, from: Data(jsonSubstring.utf8))

        let sanitizedFallback = stripASRSpecialTokens(sanitizeSpeechTranscript(transcript))

        let title: String
        if let candidate = decoded.title?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty {
            title = candidate
        } else {
            title = generateTitle(from: splitIntoSentences(sanitizedFallback), raw: transcript)
        }

        let summary: String
        if let candidate = decoded.summary?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty {
            summary = candidate
        } else {
            summary = "Voice memo lightly proofread on-device."
        }

        // Strip as a safety net even when the model returned its own cleanedText -- small models
        // don't always follow the "omit bracketed annotations" instruction reliably.
        let cleanedText: String
        if let candidate = decoded.cleanedText?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty {
            cleanedText = sanitizeSpeechTranscript(stripASRSpecialTokens(candidate))
        } else {
            cleanedText = sanitizedFallback
        }

        let tags = (decoded.tags?.isEmpty == false) ? decoded.tags! : extractTags(from: transcript)

        return LLMProcessingResult(
            title: title,
            summary: summary,
            requirements: [],
            conditions: [],
            actionItems: [],
            cleanedMarkdown: cleanedText,
            tags: tags,
            engine: engine.label
        )
    }

    /// The light rewrite of a long memo: each part is proofread on its own and the texts are
    /// joined as paragraphs. A part that fails keeps its own sanitized transcript, so no words
    /// go missing; title and summary come from the first part that had them.
    private func processLongLight(parts: [TranscriptPart], transcript: String, dictionary: [DictionaryEntry], engine: StageTwoEngine) async throws -> LLMProcessingResult {
        var results: [LLMProcessingResult] = []
        var texts: [String] = []
        for part in parts {
            try Task.checkCancellation()
            do {
                let result = try await processLight(transcript: part.text, dictionary: dictionary, engine: engine)
                results.append(result)
                texts.append(result.cleanedMarkdown)
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                texts.append(stripASRSpecialTokens(sanitizeSpeechTranscript(part.text)))
            }
        }
        guard let first = results.first else { throw LLMCopywriterError.unparsableResponse }
        return LLMProcessingResult(
            title: first.title,
            summary: first.summary,
            requirements: [],
            conditions: [],
            actionItems: [],
            cleanedMarkdown: texts.joined(separator: "\n\n"),
            tags: Self.mergedTags(results.map(\.tags)),
            engine: engine.label
        )
    }

    // MARK: - Apple Foundation Model (System FoundationModels Framework)

    private func processWithAppleFoundationModel(transcript: String, mode: RewriteMode, dictionary: [DictionaryEntry], templates: [NoteTemplate]) async throws -> LLMProcessingResult {
        let engine = StageTwoEngine(label: CleanupEngineLabel.appleFoundationModel) { system, user, _ in
            try await AppleFoundationModelService.shared.generate(systemPrompt: system, userPrompt: user)
        }
        return try await process(transcript: transcript, mode: mode, dictionary: dictionary, templates: templates, engine: engine)
    }

    /// Small models occasionally wrap valid JSON in prose or code fences despite instructions;
    /// take the outermost `{...}` span rather than failing on the first stray character.
    private static func extractJSONObject(from text: String) -> String? {
        guard let firstBrace = text.firstIndex(of: "{"),
              let lastBrace = text.lastIndex(of: "}"),
              firstBrace < lastBrace else {
            return nil
        }
        return String(text[firstBrace...lastBrace])
    }

    // MARK: - Personal Dictionary Prompt Injection

    /// Smaller than `ASRService.maxVocabularyTerms` since this string enters a small on-device
    /// model's limited context window on every Stage-2 call (the .full pass eagerly, the .light
    /// pass whenever `NoteProcessingPipeline.generateLightCleanup` runs it on demand).
    static let maxDictionaryTermsInPrompt = 50

    /// Aliases shown per term, as examples of how speech recognition mishears it.
    static let maxAliasesPerTermInPrompt = 3

    /// Renders the dictionary as an instruction block appended to a system prompt. Small models
    /// follow a worked example far better than "fix close variants" (a real note kept
    /// "Wotsbrief" for "Voxbrief" under that wording), so the block says the transcript is
    /// speech-recognized, gives an example with an invented term (so it can't leak into a note),
    /// and lists each term with its `contextHint` and the user's own `aliases`:
    /// `term (hint; often misheard as "a", "b")`. Caution is limited to a term that clearly
    /// doesn't fit the sentence. Returns "" for an empty dictionary so callers can interpolate it
    /// unconditionally. `internal` (not `private`) so it's directly unit-testable.
    func dictionaryInstructionBlock(_ dictionary: [DictionaryEntry]) -> String {
        guard !dictionary.isEmpty else { return "" }
        let rendered = dictionary.prefix(Self.maxDictionaryTermsInPrompt).map { entry -> String in
            var notes: [String] = []
            if let hint = entry.contextHint?.trimmingCharacters(in: .whitespacesAndNewlines), !hint.isEmpty {
                notes.append(hint)
            }
            let aliases = entry.aliases
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .prefix(Self.maxAliasesPerTermInPrompt)
            if !aliases.isEmpty {
                notes.append("often misheard as " + aliases.map { "\"\($0)\"" }.joined(separator: ", "))
            }
            return notes.isEmpty ? "- \(entry.term)" : "- \(entry.term) (\(notes.joined(separator: "; ")))"
        }.joined(separator: "\n")
        return "\n\nPersonal dictionary: the transcript comes from speech recognition, which often "
            + "mishears names and jargon. Any word or phrase that sounds like one of the terms "
            + "below is almost certainly that term: write the term with exactly this spelling and "
            + "capitalization everywhere, including the title. For example, if the list had "
            + "\"Zentrify\", a transcript saying \"Sentrafy\" or \"send trify\" means Zentrify. "
            + "Keep the original word only when the term clearly makes no sense in that sentence "
            + "(a note in parentheses says what a term is). Terms:\n\(rendered)"
    }

    /// The user message for a generation call: the transcript, preceded by a one-line reminder
    /// of the dictionary terms when there are any. Small models weigh what's next to the
    /// transcript more than the end of a long system prompt. Unchanged transcript otherwise.
    func transcriptUserPrompt(_ transcript: String, dictionary: [DictionaryEntry]) -> String {
        guard !dictionary.isEmpty else { return transcript }
        let terms = dictionary.prefix(Self.maxDictionaryTermsInPrompt).map(\.term).joined(separator: ", ")
        return "Dictionary terms (anything that sounds like one is that term): \(terms)\n\nTranscript:\n\(transcript)"
    }

    // MARK: - On-Device NLP & Semantic Transformation Engine

    /// Rule-based structuring of text an LLM already wrote (the legacy Ollama rewrite's prose).
    /// No longer a fallback for when no AI engine runs. `internal` so it's unit-testable.
    func transformLocally(rawTranscript: String) -> LLMProcessingResult {
        // 1. Clean speech artifacts, filler words, and fix common tech typos
        let sanitized = sanitizeSpeechTranscript(rawTranscript)
        
        // 2. Break into logical sentences
        let rawSentences = splitIntoSentences(sanitized)
        let cleanedSentences = rawSentences.map { cleanAndFormatSentence($0) }.filter { !$0.isEmpty }
        
        // 3. Extract Requirements (Requirements -> Bullet points)
        var requirements: [String] = []
        // 4. Extract Enumerated Conditions (Conditions -> Numbered formatting)
        var conditions: [String] = []
        // 5. Extract Action Items
        var actionItems: [String] = []
        // 6. Remaining body content
        var generalPoints: [String] = []
        
        for sentence in cleanedSentences {
            if isConditionOrSequential(sentence) {
                let cleanedCondition = stripLeadingMarkers(from: sentence, markers: [
                    "condition 1:", "condition 2:", "condition 3:", "condition:",
                    "first,", "firstly,", "first of all,", "second,", "secondly,",
                    "third,", "thirdly,", "step 1:", "step 2:", "step 3:",
                    "then,", "next,", "finally,", "step 1", "step 2", "first", "second", "third"
                ])
                conditions.append(cleanedCondition)
            } else if isRequirement(sentence) {
                let cleanedReq = stripLeadingMarkers(from: sentence, markers: [
                    "we need to", "we must", "requirement is to", "requirement is",
                    "requirements include", "make sure to", "ensure that", "needs to",
                    "it's essential that", "required to", "must have", "should have"
                ])
                requirements.append(cleanedReq)
            } else if isActionItem(sentence) {
                let cleanedAction = stripLeadingMarkers(from: sentence, markers: [
                    "todo:", "todo", "action item:", "action item", "remember to",
                    "don't forget to", "follow up with", "assign to"
                ])
                actionItems.append(cleanedAction)
            } else {
                generalPoints.append(sentence)
            }
        }
        
        // If no explicit conditions found, inspect sentences for sequential flow
        if conditions.isEmpty && cleanedSentences.count >= 2 {
            for (idx, sentence) in cleanedSentences.enumerated() {
                if sentence.lowercased().contains("if ") || sentence.lowercased().contains("when ") {
                    conditions.append(sentence)
                }
            }
        }
        
        // 7. Title Generation
        let title = generateTitle(from: cleanedSentences, raw: sanitized)
        
        // 8. Summary Generation
        let summary = generateSummary(sentences: cleanedSentences, requirements: requirements, conditions: conditions)
        
        // 9. Tag Discovery
        let tags = extractTags(from: sanitized)

        // 10. Rule-based `.full` output is always Design-Doc-shaped -- template selection needs
        //     an LLM to do reliably, which this deterministic fallback doesn't have.
        var sections: [TemplateSectionContent] = []
        if !requirements.isEmpty {
            sections.append(TemplateSectionContent(title: NoteTemplate.designDoc.sections[0].title, style: .bullet, items: requirements))
        }
        if !conditions.isEmpty {
            sections.append(TemplateSectionContent(title: NoteTemplate.designDoc.sections[1].title, style: .numbered, items: conditions))
        }
        if !actionItems.isEmpty {
            sections.append(TemplateSectionContent(title: NoteTemplate.designDoc.sections[2].title, style: .checklist, items: actionItems))
        }
        if !generalPoints.isEmpty {
            sections.append(TemplateSectionContent(title: "📝 Polished Transcript & Notes", style: .paragraph, items: generalPoints))
        }

        // 11. Assemble Rich Markdown Layout
        let markdown = assembleMarkdown(title: title, summary: summary, sections: sections)

        return LLMProcessingResult(
            title: title,
            summary: summary,
            requirements: requirements,
            conditions: conditions,
            actionItems: actionItems,
            cleanedMarkdown: markdown,
            tags: tags,
            engine: CleanupEngineLabel.ruleBased,
            sections: sections,
            templateId: NoteTemplate.designDoc.id,
            templateName: NoteTemplate.designDoc.name
        )
    }
    
    /// Strips WhisperKit's bracketed non-speech annotations (e.g. "[Laughter]",
    /// "[ Inaudible Remark ]", "[Music]", "[BLANK_AUDIO]") -- these are audio-event tags the ASR
    /// model emits, not spoken words. Light Cleanup otherwise preserves the transcript verbatim,
    /// so these need removing explicitly rather than being kept as if they were content.
    func stripASRSpecialTokens(_ text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "\\[[^\\[\\]]*\\]") else { return text }
        var result = regex.stringByReplacingMatches(
            in: text,
            options: [],
            range: NSRange(location: 0, length: text.utf16.count),
            withTemplate: ""
        )
        while result.contains("  ") {
            result = result.replacingOccurrences(of: "  ", with: " ")
        }
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Light-mode counterpart to `transformLocally`: fixes typos, filler words, and tech-term
    /// capitalization but never buckets sentences into requirements/conditions/action items --
    /// the output stays in the transcript's original order as plain prose.
    func transformLocallyLight(rawTranscript: String) -> LLMProcessingResult {
        let sanitized = stripASRSpecialTokens(sanitizeSpeechTranscript(rawTranscript))
        let cleanedSentences = splitIntoSentences(sanitized).map { cleanAndFormatSentence($0) }.filter { !$0.isEmpty }

        let title = generateTitle(from: cleanedSentences, raw: sanitized)
        let summary = generateSummary(sentences: cleanedSentences, requirements: [], conditions: [])
        let tags = extractTags(from: sanitized)
        let cleanedText = cleanedSentences.joined(separator: " ")

        return LLMProcessingResult(
            title: title,
            summary: summary,
            requirements: [],
            conditions: [],
            actionItems: [],
            cleanedMarkdown: cleanedText,
            tags: tags,
            engine: CleanupEngineLabel.ruleBased
        )
    }

    // MARK: - Linguistic Pattern Detectors
    
    private func isRequirement(_ sentence: String) -> Bool {
        let lower = sentence.lowercased()
        let patterns = [
            "need to", "must have", "requirement", "require",
            "make sure", "ensure", "essential", "should have",
            "have to", "is required", "mandatory"
        ]
        return patterns.contains { lower.contains($0) }
    }
    
    private func isConditionOrSequential(_ sentence: String) -> Bool {
        let lower = sentence.lowercased()
        let conditionCues = [
            "condition", "if ", "provided that", "in case",
            "first,", "firstly", "second,", "secondly", "third,",
            "step 1", "step 2", "step 3", "then ", "finally,"
        ]
        return conditionCues.contains { lower.contains($0) }
    }
    
    private func isActionItem(_ sentence: String) -> Bool {
        let lower = sentence.lowercased()
        let actionCues = [
            "todo", "action item", "remember to", "don't forget",
            "follow up", "assign to", "check on", "verify with"
        ]
        return actionCues.contains { lower.contains($0) }
    }
    
    // MARK: - Cleaning & Normalization
    
    private func sanitizeSpeechTranscript(_ text: String) -> String {
        var result = text
        
        // Remove speech filler words
        let fillers = [
            "\\bum\\b", "\\buh\\b", "\\byou know\\b", "\\blike, you know\\b",
            "\\bsort of\\b", "\\bkind of\\b", "\\bso basically\\b", "\\bso um\\b"
        ]
        for filler in fillers {
            if let regex = try? NSRegularExpression(pattern: filler, options: .caseInsensitive) {
                result = regex.stringByReplacingMatches(
                    in: result,
                    options: [],
                    range: NSRange(location: 0, length: result.utf16.count),
                    withTemplate: ""
                )
            }
        }
        
        // Correct common tech terminology and capitalization
        let techReplacements: [String: String] = [
            "\\bios\\b": "iOS",
            "\\bwatchos\\b": "watchOS",
            "\\bmacos\\b": "macOS",
            "\\basr\\b": "ASR",
            "\\bllm\\b": "LLM",
            "\\bapi\\b": "API",
            "\\bui\\b": "UI",
            "\\bux\\b": "UX",
            "\\bswiftui\\b": "SwiftUI",
            "\\bxcode\\b": "Xcode",
            "\\bcoreml\\b": "CoreML",
            "\\bwifi\\b": "Wi-Fi",
            "\\bapple watch\\b": "Apple Watch",
            "\\blive activity\\b": "Live Activity"
        ]
        
        for (pattern, replacement) in techReplacements {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                result = regex.stringByReplacingMatches(
                    in: result,
                    options: [],
                    range: NSRange(location: 0, length: result.utf16.count),
                    withTemplate: replacement
                )
            }
        }
        
        // Collapse multiple spaces
        while result.contains("  ") {
            result = result.replacingOccurrences(of: "  ", with: " ")
        }
        
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private func splitIntoSentences(_ text: String) -> [String] {
        var sentences: [String] = []
        text.enumerateSubstrings(in: text.startIndex..<text.endIndex, options: [.bySentences]) { substring, _, _, _ in
            if let s = substring?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
                sentences.append(s)
            }
        }
        if sentences.isEmpty && !text.isEmpty {
            sentences = text.components(separatedBy: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        }
        return sentences
    }
    
    private func cleanAndFormatSentence(_ sentence: String) -> String {
        var s = sentence.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return "" }
        
        // Capitalize first character
        let first = s.prefix(1).uppercased()
        s = first + s.dropFirst()
        
        // Ensure ends with a period if not punctuation
        if let last = s.last, !".!?:;".contains(last) {
            s.append(".")
        }
        return s
    }
    
    private func stripLeadingMarkers(from sentence: String, markers: [String]) -> String {
        var result = sentence
        let lower = result.lowercased()
        for marker in markers {
            if lower.hasPrefix(marker) {
                let dropCount = marker.count
                let index = result.index(result.startIndex, offsetBy: dropCount)
                result = String(result[index...]).trimmingCharacters(in: .whitespacesAndNewlines)
                break
            }
        }
        return cleanAndFormatSentence(result)
    }
    
    // MARK: - Title, Summary & Tag Extraction
    
    private func generateTitle(from sentences: [String], raw: String) -> String {
        guard let first = sentences.first else { return "Voice Note" }
        var candidate = first
            .replacingOccurrences(of: "We need to build ", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "We need to ", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "So basically ", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "This is a note about ", with: "", options: .caseInsensitive)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".!?:; \n"))
        
        let words = candidate.components(separatedBy: .whitespaces)
        if words.count > 7 {
            candidate = words.prefix(6).joined(separator: " ") + "..."
        }
        
        let firstCap = candidate.prefix(1).uppercased()
        return firstCap + candidate.dropFirst()
    }
    
    private func generateSummary(sentences: [String], requirements: [String], conditions: [String]) -> String {
        if let first = sentences.first {
            return first
        }
        return "Voice memo captured and structured with on-device LLM cleanup."
    }
    
    private func extractTags(from text: String) -> [String] {
        var tags: Set<String> = []
        let lower = text.lowercased()
        
        if lower.contains("watch") || lower.contains("apple watch") { tags.insert("#watchOS") }
        if lower.contains("ios") || lower.contains("iphone") { tags.insert("#iOS") }
        if lower.contains("asr") || lower.contains("speech") || lower.contains("transcript") { tags.insert("#ASR") }
        if lower.contains("llm") || lower.contains("model") || lower.contains("ai") { tags.insert("#AI") }
        if lower.contains("requirement") || lower.contains("spec") { tags.insert("#Requirements") }
        if lower.contains("meeting") || lower.contains("discuss") { tags.insert("#Meeting") }
        if lower.contains("todo") || lower.contains("task") || lower.contains("action item") { tags.insert("#Tasks") }
        if lower.contains("idea") || lower.contains("concept") { tags.insert("#Idea") }
        
        if tags.isEmpty {
            tags.insert("#QuickCapture")
        }
        
        return Array(tags).sorted()
    }
    
    // MARK: - Markdown Assembly
    
    /// Generalized over an arbitrary template's sections instead of three fixed
    /// requirements/conditions/actionItems blocks -- the Design Doc template's section titles
    /// match the original hardcoded strings exactly, so output for that template is byte-
    /// identical to before this generalized. `internal` for direct unit testing.
    func assembleMarkdown(title: String, summary: String, sections: [TemplateSectionContent]) -> String {
        var md = "# \(title)\n\n"
        md += "> \(summary)\n\n"

        for section in sections where !section.items.isEmpty {
            md += "### \(section.title)\n"
            switch section.style {
            case .bullet:
                for item in section.items {
                    md += "- \(item)\n"
                }
            case .numbered:
                for (index, item) in section.items.enumerated() {
                    md += "\(index + 1). \(item)\n"
                }
            case .checklist:
                for item in section.items {
                    md += "- [ ] \(item)\n"
                }
            case .paragraph:
                md += section.items.joined(separator: " ") + "\n"
            }
            md += "\n"
        }

        return md.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    // MARK: - Optional Local LLM (e.g. Ollama / Local Server) Call
    
    private func callLocalLLMEndpoint(url: URL, model: String, transcript: String, mode: RewriteMode, dictionary: [DictionaryEntry], templates: [NoteTemplate]) async throws -> LLMProcessingResult {
        switch mode {
        case .full:
            return try await callLocalLLMEndpointFull(url: url, model: model, transcript: transcript, dictionary: dictionary, templates: templates)
        case .light:
            return try await callLocalLLMEndpointLight(url: url, model: model, transcript: transcript, dictionary: dictionary)
        }
    }

    /// Raw POST-and-extract-`"response"` mechanics shared by every Ollama call below.
    private func postToOllama(prompt: String, url: URL, model: String) async throws -> String {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10.0
        let body: [String: Any] = [
            "model": model,
            "prompt": prompt,
            "stream": false
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let responseText = json["response"] as? String else {
            throw URLError(.cannotParseResponse)
        }
        let trimmed = responseText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw URLError(.zeroByteResource)
        }
        return trimmed
    }

    private func callLocalLLMEndpointLight(url: URL, model: String, transcript: String, dictionary: [DictionaryEntry]) async throws -> LLMProcessingResult {
        let prompt = """
        Lightly proofread the following raw voice transcript: fix typos, grammar, and remove \
        filler words (um, uh, you know, sort of). Also remove any bracketed non-speech \
        annotations the speech recognizer inserted, such as [Laughter], [Music], or \
        [Inaudible Remark] -- these are the recognizer's own audio-event tags, not spoken \
        words. Keep the original wording, sentence order, and level of detail for everything \
        actually spoken -- do not restructure it into lists or sections, and do not add \
        commentary. Return only the corrected transcript as plain prose.\(dictionaryInstructionBlock(dictionary))

        Transcript:
        \(transcript)
        """
        let trimmedResponse = try await postToOllama(prompt: prompt, url: url, model: model)
        let structured = transformLocallyLight(rawTranscript: trimmedResponse)
        return LLMProcessingResult(
            title: structured.title,
            summary: structured.summary,
            requirements: [],
            conditions: [],
            actionItems: [],
            cleanedMarkdown: stripASRSpecialTokens(trimmedResponse),
            tags: structured.tags,
            engine: CleanupEngineLabel.ollama(model: model)
        )
    }

    /// Same classify-then-generate flow as the on-device path, over HTTP instead of MLX -- needed
    /// (not just for consistency) because the old prose-instructed approach can only ever bucket
    /// into requirements/conditions/actionItems via `transformLocally`, never into Email/Tweet/
    /// custom template fields. Falls back to `legacyOllamaFullRewrite` if the JSON flow fails,
    /// since an arbitrary user-configured Ollama model is more likely to ignore JSON-formatting
    /// instructions than the bundled on-device one -- keeps that failure mode exactly as
    /// recoverable as it was before multi-template support existed.
    private func callLocalLLMEndpointFull(url: URL, model: String, transcript: String, dictionary: [DictionaryEntry], templates: [NoteTemplate]) async throws -> LLMProcessingResult {
        let availableTemplates = templates.isEmpty ? NoteTemplate.builtIns : templates
        do {
            let chosenTemplate: NoteTemplate
            if let only = Self.singleTemplate(in: availableTemplates) {
                chosenTemplate = only
            } else {
                let classificationPrompt = buildClassificationSystemPrompt(templates: availableTemplates) + "\n\nTranscript:\n\(transcript)"
                let classificationRaw = try await postToOllama(prompt: classificationPrompt, url: url, model: model)
                chosenTemplate = resolveTemplate(fromClassificationRaw: classificationRaw, candidates: availableTemplates, fallback: effectiveFallbackTemplate(in: availableTemplates))
            }

            let generationPrompt = buildGenerationSystemPrompt(template: chosenTemplate, dictionary: dictionary) + "\n\nTranscript:\n\(transcript)"
            let generationRaw = try await postToOllama(prompt: generationPrompt, url: url, model: model)
            let parsed = try parseGenerationResponse(generationRaw, template: chosenTemplate)

            let title: String
            if let candidate = parsed.title?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty {
                title = candidate
            } else {
                title = generateTitle(from: splitIntoSentences(sanitizeSpeechTranscript(transcript)), raw: transcript)
            }

            let summary: String
            if let candidate = parsed.summary?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty {
                summary = candidate
            } else {
                summary = "Voice memo captured and structured via Ollama."
            }

            let tags = (parsed.tags?.isEmpty == false) ? parsed.tags! : extractTags(from: transcript)
            let (requirements, conditions, actionItems) = Self.legacyFields(from: parsed.sections)
            let markdown = assembleMarkdown(title: title, summary: summary, sections: parsed.sections)

            return LLMProcessingResult(
                title: title,
                summary: summary,
                requirements: requirements,
                conditions: conditions,
                actionItems: actionItems,
                cleanedMarkdown: markdown,
                tags: tags,
                engine: CleanupEngineLabel.ollama(model: model),
                sections: parsed.sections,
                templateId: chosenTemplate.id,
                templateName: chosenTemplate.name
            )
        } catch {
            // The legacy rewrite is always Design-Doc-shaped, so it can't stand in for a
            // template the user picked explicitly.
            if let only = Self.singleTemplate(in: availableTemplates), only.id != NoteTemplate.designDoc.id {
                throw error
            }
            print("[LLMCopywriterService] Ollama JSON template flow failed, falling back to legacy prose rewrite: \(error)")
            return try await legacyOllamaFullRewrite(url: url, model: model, transcript: transcript, dictionary: dictionary)
        }
    }

    /// Today's original Ollama `.full` behavior (prose instructions, then reusing the rule-based
    /// extractor on the model's own raw output) -- kept as a fallback for when a user-configured
    /// Ollama model doesn't cooperate with the JSON-schema flow above, preserving the exact
    /// robustness floor Ollama had before multi-template support existed.
    private func legacyOllamaFullRewrite(url: URL, model: String, transcript: String, dictionary: [DictionaryEntry]) async throws -> LLMProcessingResult {
        let prompt = """
        You are an on-device executive copywriter. Transform the following raw voice transcript into clean, structured Markdown:
        1. Requirements must be converted into bullet points.
        2. Enumerated conditions must use numbered formatting (1., 2., ...).
        3. Fix all grammar and typos.\(dictionaryInstructionBlock(dictionary))

        Transcript:
        \(transcript)
        """
        let trimmedResponse = try await postToOllama(prompt: prompt, url: url, model: model)
        let structured = transformLocally(rawTranscript: trimmedResponse)
        return LLMProcessingResult(
            title: structured.title,
            summary: structured.summary,
            requirements: structured.requirements,
            conditions: structured.conditions,
            actionItems: structured.actionItems,
            cleanedMarkdown: trimmedResponse,
            tags: structured.tags,
            engine: CleanupEngineLabel.ollama(model: model)
        )
    }
}
