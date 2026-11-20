import XCTest
@testable import Voxbrief

fileprivate final class MockASRService: ASRServiceProtocol {
    var stubTranscript = "stub transcript"
    /// When non-empty, each call pops the next value (falling back to `stubTranscript` once
    /// drained) -- lets a test give successive append calls distinct transcripts.
    var transcriptQueue: [String] = []
    private(set) var receivedVocabulary: [String] = []
    private(set) var receivedAudioURLs: [URL] = []
    private(set) var warmUpCallCount = 0

    var onProgressEmissions: [String] = []

    func transcribeAudio(
        at fileURL: URL,
        vocabulary: [String],
        onProgress: (@Sendable (String) -> Void)?
    ) async throws -> String {
        receivedVocabulary = vocabulary
        receivedAudioURLs.append(fileURL)
        for emission in onProgressEmissions {
            onProgress?(emission)
        }
        if !transcriptQueue.isEmpty {
            return transcriptQueue.removeFirst()
        }
        return stubTranscript
    }

    func warmUp() async {
        warmUpCallCount += 1
    }
}

fileprivate final class MockLLMCopywriterService: LLMCopywriterServiceProtocol, @unchecked Sendable {
    private(set) var receivedDictionaries: [[DictionaryEntry]] = []
    private(set) var receivedTranscripts: [String] = []
    private(set) var receivedTemplates: [[NoteTemplate]] = []
    private(set) var receivedModes: [RewriteMode] = []
    private(set) var warmUpCallCount = 0
    /// Set by a test to make `process(note:)`/`reprocessStage2` copy specific template fields
    /// onto the resulting note, for asserting the pipeline threads them through correctly.
    var stubSections: [TemplateSectionContent] = []
    var stubTemplateId: UUID?
    var stubTemplateName: String = ""
    /// Set by a test to make every call fail, like when no AI engine can run.
    var stubError: Error?
    /// Set by a test to make only the structured (`.full`) call fail.
    var stubFullError: Error?
    /// The brief `writeBrief` returns (nil: none, like the protocol's default).
    var stubBrief: NoteBrief?
    var stubBriefError: Error?
    /// A title dictated with a voice command, reported on the light result.
    var stubExplicitTitle: String?
    private(set) var briefInputs: [String] = []

    func processTranscript(_ rawTranscript: String, mode: RewriteMode, dictionary: [DictionaryEntry], templates: [NoteTemplate]) async throws -> LLMProcessingResult {
        receivedDictionaries.append(dictionary)
        receivedTranscripts.append(rawTranscript)
        receivedTemplates.append(templates)
        receivedModes.append(mode)
        if let stubError { throw stubError }
        if mode == .light || mode == .conversation {
            return LLMProcessingResult(
                title: "Light Title",
                summary: "Light Summary",
                requirements: [],
                conditions: [],
                actionItems: [],
                cleanedMarkdown: "mock light",
                tags: ["#light"],
                engine: "mock-light",
                explicitTitle: stubExplicitTitle
            )
        }
        if let stubFullError { throw stubFullError }
        return LLMProcessingResult(
            title: "Mock Title",
            summary: "Mock Summary",
            requirements: [],
            conditions: [],
            actionItems: [],
            cleanedMarkdown: "mock markdown",
            tags: [],
            engine: "mock",
            sections: stubSections,
            templateId: stubTemplateId,
            templateName: stubTemplateName
        )
    }

    func warmUp() async {
        warmUpCallCount += 1
    }

    func writeBrief(cleanedText: String) async throws -> NoteBrief? {
        briefInputs.append(cleanedText)
        if let stubBriefError { throw stubBriefError }
        return stubBrief
    }
}

fileprivate struct StubSpeakerDetector: SpeakerDetecting {
    var spans: [SpeakerSpan] = []
    var error: Error?
    func speakerSpans(forAudioAt url: URL) async throws -> [SpeakerSpan] {
        if let error { throw error }
        return spans
    }
}

@MainActor
final class NoteProcessingPipelineTests: XCTestCase {

    fileprivate var mockASR: MockASRService!
    fileprivate var mockLLM: MockLLMCopywriterService!
    var repository: NoteRepository!
    var dictionaryStore: PersonalDictionaryStore!
    var templateStore: TemplateStore!
    var pipeline: NoteProcessingPipeline!

    var repositoryStorageURL: URL!
    var dictionaryStorageURL: URL!
    var templateStorageURL: URL!

    override func setUp() {
        super.setUp()
        let tempDir = FileManager.default.temporaryDirectory
        repositoryStorageURL = tempDir.appendingPathComponent("test_pipeline_notes_\(UUID().uuidString).json")
        dictionaryStorageURL = tempDir.appendingPathComponent("test_pipeline_dictionary_\(UUID().uuidString).json")
        templateStorageURL = tempDir.appendingPathComponent("test_pipeline_templates_\(UUID().uuidString).json")

        mockASR = MockASRService()
        mockLLM = MockLLMCopywriterService()
        repository = NoteRepository(customStorageURL: repositoryStorageURL)
        dictionaryStore = PersonalDictionaryStore(customStorageURL: dictionaryStorageURL)
        dictionaryStore.add(term: "Voxbrief", aliases: ["fox brief"])
        dictionaryStore.add(term: "Kubernetes")
        templateStore = TemplateStore(customStorageURL: templateStorageURL)

        pipeline = NoteProcessingPipeline(
            asrService: mockASR,
            llmService: mockLLM,
            repository: repository,
            audioFileManager: AudioFileManager(),
            dictionaryStore: dictionaryStore,
            templateStore: templateStore
        )
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: repositoryStorageURL)
        try? FileManager.default.removeItem(at: dictionaryStorageURL)
        try? FileManager.default.removeItem(at: templateStorageURL)
        super.tearDown()
    }

    func testProcessPassesDictionaryTermsAsASRVocabulary() async {
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        await pipeline.process(note: note)

        XCTAssertEqual(Set(mockASR.receivedVocabulary), Set(["Voxbrief", "Kubernetes"]))
    }

    func testProcessByDefaultRunsOnlyTheLightCleanup() async {
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        await pipeline.process(note: note)

        XCTAssertEqual(mockLLM.receivedModes, [.light])
        XCTAssertEqual(Set(mockLLM.receivedDictionaries[0].map(\.term)), Set(["Voxbrief", "Kubernetes"]))
        let saved = try? XCTUnwrap(repository.note(withId: note.id))
        XCTAssertEqual(saved?.status, .ready)
        XCTAssertEqual(saved?.title, "Light Title")
        XCTAssertEqual(saved?.lightCleanedNote, "mock light")
        XCTAssertEqual(saved?.cleanedNote, "mock light", "A cleaned-only note keeps its text in cleanedNote for exports and search")
        XCTAssertEqual(saved?.cleanedText, "mock light")
        XCTAssertEqual(saved?.hasStructuredRewrite, false)
        XCTAssertNil(saved?.templateId)
        XCTAssertNil(saved?.templateChoice)
        XCTAssertEqual(saved?.processingTimings.map(\.name), ["Transcribe", "Clean up"])
    }

    // MARK: - Speakers

    private let conversationSegments = [
        TranscriptTimingSegment(start: 0, end: 4, text: "How have you been feeling since the last visit?"),
        TranscriptTimingSegment(start: 4, end: 8, text: "Mostly fine, but the itching at night got worse."),
        TranscriptTimingSegment(start: 8, end: 12, text: "Then we check the bile acid level again this week.")
    ]

    private func speakerPipeline(_ detector: StubSpeakerDetector) -> NoteProcessingPipeline {
        NoteProcessingPipeline(
            asrService: mockASR,
            llmService: mockLLM,
            repository: repository,
            audioFileManager: AudioFileManager(),
            dictionaryStore: dictionaryStore,
            templateStore: templateStore,
            speakerDetector: detector
        )
    }

    /// Speaker detection only runs on a recording that exists.
    private func audioFile() throws -> String {
        let name = "speaker-test-\(UUID().uuidString).m4a"
        try Data([0]).write(to: AudioFileManager().url(for: name))
        addTeardownBlock { try? FileManager.default.removeItem(at: AudioFileManager().url(for: name)) }
        return name
    }

    private let twoSpeakers = StubSpeakerDetector(spans: [
        SpeakerSpan(start: 0, end: 4, speaker: 5),
        SpeakerSpan(start: 4, end: 8, speaker: 2),
        SpeakerSpan(start: 8, end: 12, speaker: 5)
    ])

    func testAConversationGetsAReadableAccountAndCleanedTurns() async throws {
        mockLLM.stubBrief = NoteBrief(title: "Itching Follow-up", summary: "Bile acid test this week.", tags: ["#health"])
        let pipeline = speakerPipeline(twoSpeakers)
        let note = VoiceNote(id: UUID(), audioFileName: try audioFile(), status: .syncing)
        repository.save(note)

        await pipeline.process(note: note, liveTranscript: ("all of it", conversationSegments))

        let saved = try XCTUnwrap(repository.note(withId: note.id))
        XCTAssertEqual(saved.speakerCount, 2)
        XCTAssertEqual(saved.speakerTurns.map(\.speaker), [0, 1, 0])
        XCTAssertEqual(saved.speakerTurns.map(\.text), conversationSegments.map(\.text))
        // The cleaned text is the conversation rewrite, read with who said what.
        XCTAssertEqual(mockLLM.receivedModes, [.conversation])
        XCTAssertEqual(mockLLM.receivedTranscripts, [
            "Speaker 1: How have you been feeling since the last visit?\n\nSpeaker 2: Mostly fine, but the itching at night got worse.\n\nSpeaker 1: Then we check the bile acid level again this week."
        ])
        XCTAssertEqual(saved.cleanedText, "mock light")
        XCTAssertEqual(mockLLM.briefInputs, ["mock light"])
        XCTAssertEqual(saved.title, "Itching Follow-up")
        XCTAssertEqual(saved.processingTimings.map(\.name), ["Transcribe (live)", "Speakers", "Clean up", "Title & summary", "Speaker turns (3)"])
    }

    func testWhisperTokensNeverReachTheTurns() async throws {
        let pipeline = speakerPipeline(twoSpeakers)
        let note = VoiceNote(id: UUID(), audioFileName: try audioFile(), status: .syncing)
        repository.save(note)
        let tokenized = [
            TranscriptTimingSegment(start: 0, end: 4, text: "<|startoftranscript|><|0.00|> How have you been feeling? <|3.66|><|endoftext|>"),
            TranscriptTimingSegment(start: 4, end: 6, text: "<|startoftranscript|><|0.00|> <|4.18|><|endoftext|>"),
            TranscriptTimingSegment(start: 6, end: 8, text: "<|0.00|> (silence) Itchy at night, mostly fine otherwise.<|7.36|>"),
            TranscriptTimingSegment(start: 8, end: 12, text: ">> [BLANK_AUDIO] Then we check the bile acid level.")
        ]

        await pipeline.process(note: note, liveTranscript: ("all of it", tokenized))

        let saved = try XCTUnwrap(repository.note(withId: note.id))
        XCTAssertEqual(saved.speakerTurns.map(\.text), [
            "How have you been feeling?",
            "Itchy at night, mostly fine otherwise.",
            "Then we check the bile acid level."
        ])
    }

    func testOneSpeakerIsAMemo() async throws {
        let pipeline = speakerPipeline(StubSpeakerDetector(spans: [SpeakerSpan(start: 0, end: 12, speaker: 0)]))
        let note = VoiceNote(id: UUID(), audioFileName: try audioFile(), status: .syncing)
        repository.save(note)

        await pipeline.process(note: note, liveTranscript: ("all of it", conversationSegments))

        let saved = try XCTUnwrap(repository.note(withId: note.id))
        XCTAssertEqual(saved.speakerCount, 1)
        XCTAssertTrue(saved.speakerTurns.isEmpty)
        XCTAssertEqual(mockLLM.receivedModes, [.light])
    }

    func testFailedDetectionLeavesAMemoToTryAgainOnReRun() async throws {
        var failing = twoSpeakers
        failing.error = ASRError.emptyAudio
        let note = VoiceNote(id: UUID(), audioFileName: try audioFile(), status: .syncing)
        repository.save(note)

        await speakerPipeline(failing).process(note: note, liveTranscript: ("all of it", conversationSegments))
        XCTAssertNil(repository.note(withId: note.id)?.speakerCount)
        XCTAssertEqual(repository.note(withId: note.id)?.status, .ready)

        // Re-run, as for a note from before speaker detection: it runs this time.
        await speakerPipeline(twoSpeakers).reprocessWithLLM(noteId: note.id)
        let saved = try XCTUnwrap(repository.note(withId: note.id))
        XCTAssertEqual(saved.speakerCount, 2)
        XCTAssertEqual(saved.speakerTurns.count, 3)
        XCTAssertTrue(saved.processingTimings.map(\.name).contains("Speakers"))
    }

    func testABriefStoppedByBackgroundingLeavesTheNotePending() async throws {
        mockLLM.stubBriefError = OnDeviceLLMError.unavailableWhileBackgrounded
        NoteProcessingPipeline.isAppInBackground = { true }
        defer { NoteProcessingPipeline.isAppInBackground = { false } }
        let note = VoiceNote(id: UUID(), audioFileName: try audioFile(), status: .syncing)
        repository.save(note)

        await speakerPipeline(StubSpeakerDetector()).process(note: note, liveTranscript: ("all of it", conversationSegments))

        let saved = try XCTUnwrap(repository.note(withId: note.id))
        XCTAssertEqual(saved.status, .cleaningLLM, "Finished when the app is back, not saved half done")
        XCTAssertNil(saved.lightCleanedNote)
    }

    func testDictationSkipsSpeakerDetection() async throws {
        let pipeline = speakerPipeline(twoSpeakers)
        let note = VoiceNote(id: UUID(), audioFileName: try audioFile(), status: .syncing)
        repository.save(note)

        pipeline.skipBrief(for: note.id)
        await pipeline.process(note: note, liveTranscript: ("all of it", conversationSegments))

        let saved = try XCTUnwrap(repository.note(withId: note.id))
        XCTAssertNil(saved.speakerCount)
        XCTAssertTrue(saved.speakerTurns.isEmpty)
    }

    func testBriefWritesTitleAndSummaryFromTheCleanedText() async {
        mockLLM.stubBrief = NoteBrief(title: "Brief Title", summary: "Brief summary.", partCount: 3)
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        await pipeline.process(note: note)

        XCTAssertEqual(mockLLM.briefInputs, ["mock light"])
        let saved = repository.note(withId: note.id)
        XCTAssertEqual(saved?.title, "Brief Title")
        XCTAssertEqual(saved?.summary, "Brief summary.")
        XCTAssertEqual(saved?.processingTimings.map(\.name), ["Transcribe", "Clean up", "Title & summary (3 parts)"])
    }

    func testStructuredRewriteKeepsTheBriefsSummary() async {
        mockLLM.stubBrief = NoteBrief(title: "Brief Title", summary: "Brief summary.")
        var note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        note.templateChoice = .auto
        repository.save(note)

        await pipeline.process(note: note)

        let saved = repository.note(withId: note.id)
        XCTAssertEqual(saved?.cleanedNote, "mock markdown")
        XCTAssertEqual(saved?.title, "Brief Title")
        XCTAssertEqual(saved?.summary, "Brief summary.")
    }

    func testBriefKeepsADictatedTitle() async {
        mockLLM.stubBrief = NoteBrief(title: "Brief Title", summary: "Brief summary.")
        mockLLM.stubExplicitTitle = "Light Title"
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        await pipeline.process(note: note)

        let saved = repository.note(withId: note.id)
        XCTAssertEqual(saved?.title, "Light Title")
        XCTAssertEqual(saved?.summary, "Brief summary.")
    }

    func testFailedBriefKeepsTheCleanupsTitleAndSummary() async {
        mockLLM.stubBriefError = LLMCopywriterError.unparsableResponse
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        await pipeline.process(note: note)

        let saved = repository.note(withId: note.id)
        XCTAssertEqual(saved?.status, .ready)
        XCTAssertEqual(saved?.title, "Light Title")
        XCTAssertEqual(saved?.summary, "Light Summary")
    }

    func testDictationCaptureSkipsTheBrief() async {
        mockLLM.stubBrief = NoteBrief(title: "Brief Title", summary: "Brief summary.")
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        pipeline.skipBrief(for: note.id)
        await pipeline.process(note: note)

        XCTAssertTrue(mockLLM.briefInputs.isEmpty)
        XCTAssertEqual(repository.note(withId: note.id)?.title, "Light Title")

        // Only that run: processing the note again writes one.
        await pipeline.reprocessWithLLM(noteId: note.id)
        XCTAssertEqual(mockLLM.briefInputs, ["mock light"])
    }

    func testProcessWithAChosenTemplateAddsTheStructuredRewrite() async {
        let templateId = NoteTemplate.email.id
        mockLLM.stubSections = [TemplateSectionContent(title: "Subject", style: .paragraph, items: ["Team sync notes"])]
        mockLLM.stubTemplateId = templateId
        mockLLM.stubTemplateName = "Email"

        var note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        note.templateChoice = .template(templateId)
        repository.save(note)

        await pipeline.process(note: note)

        XCTAssertEqual(mockLLM.receivedModes, [.light, .full])
        XCTAssertEqual(mockLLM.receivedTemplates.last?.map(\.id), [templateId])
        let saved = repository.note(withId: note.id)
        XCTAssertEqual(saved?.templateSections, mockLLM.stubSections)
        XCTAssertEqual(saved?.templateId, templateId)
        XCTAssertEqual(saved?.templateName, "Email")
        XCTAssertEqual(saved?.cleanedNote, "mock markdown")
        XCTAssertEqual(saved?.lightCleanedNote, "mock light")
        XCTAssertEqual(saved?.hasStructuredRewrite, true)
        XCTAssertEqual(saved?.title, "Light Title", "The title always comes from the light cleanup")
        XCTAssertNil(saved?.templateChoice, "A finished structured rewrite clears the request")
    }

    func testProcessWithAutoDetectPassesTheEnabledTemplates() async {
        var note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        note.templateChoice = .auto
        repository.save(note)

        await pipeline.process(note: note)

        XCTAssertEqual(mockLLM.receivedModes, [.light, .full])
        XCTAssertEqual(mockLLM.receivedTemplates.last?.map(\.id), templateStore.enabledTemplates.map(\.id))
    }

    func testProcessUsesTheDefaultFormatFromSettings() async {
        let key = NoteProcessingPipeline.defaultTemplateChoiceKey
        let previous = UserDefaults.standard.object(forKey: key)
        UserDefaults.standard.set(TemplateChoice.auto.rawValue, forKey: key)
        defer {
            if let previous { UserDefaults.standard.set(previous, forKey: key) }
            else { UserDefaults.standard.removeObject(forKey: key) }
        }
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        await pipeline.process(note: note)

        XCTAssertEqual(mockLLM.receivedModes, [.light, .full])
    }

    func testProcessKeepsTheCleanedTextWhenTheStructuredRewriteFails() async {
        mockLLM.stubFullError = LLMCopywriterError.unparsableResponse
        var note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        note.templateChoice = .auto
        repository.save(note)

        await pipeline.process(note: note)

        let saved = repository.note(withId: note.id)
        XCTAssertEqual(saved?.status, .ready)
        XCTAssertEqual(saved?.cleanedText, "mock light")
        XCTAssertEqual(saved?.hasStructuredRewrite, false)
        XCTAssertEqual(saved?.templateChoice, .auto, "The request stays so the note can offer to try again")
    }

    func testProcessAppliesDeterministicCorrectionBeforeStage2() async {
        mockASR.stubTranscript = "Let's discuss fox brief today."
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        await pipeline.process(note: note)

        XCTAssertEqual(mockLLM.receivedTranscripts.first, "Let's discuss Voxbrief today.")
        XCTAssertEqual(repository.note(withId: note.id)?.rawTranscript, "Let's discuss Voxbrief today.")
    }

    func testReprocessWithLLMThreadsDictionaryWithoutCallingASR() async {
        let note = VoiceNote(id: UUID(), rawTranscript: "fox brief needs a fix.", status: .ready)
        repository.save(note)

        await pipeline.reprocessWithLLM(noteId: note.id)

        XCTAssertTrue(mockASR.receivedVocabulary.isEmpty, "reprocessWithLLM should never call ASR")
        XCTAssertEqual(mockLLM.receivedModes, [.light], "A cleaned-only note is re-run as cleaned text only")
        XCTAssertEqual(mockLLM.receivedTranscripts.first, "Voxbrief needs a fix.", "Dictionary correction should retroactively apply to the stored transcript")
    }

    func testReprocessWithLLMRegeneratesTheLightCleanup() async {
        let note = VoiceNote(id: UUID(), rawTranscript: "fox brief needs a fix.", cleanedNote: "stale text", status: .ready, lightCleanedNote: "stale text", lightCleanupEngine: "mock")
        repository.save(note)

        await pipeline.reprocessWithLLM(noteId: note.id)

        let updated = repository.note(withId: note.id)
        XCTAssertEqual(updated?.lightCleanedNote, "mock light")
        XCTAssertEqual(updated?.lightCleanupEngine, "mock-light")
    }

    func testReprocessKeepsAStructuredNotesTemplate() async {
        let note = VoiceNote(id: UUID(), rawTranscript: "Send the launch update.", cleanedNote: "old", status: .ready, templateId: NoteTemplate.email.id, templateName: "Email")
        repository.save(note)

        await pipeline.reprocessWithLLM(noteId: note.id)

        XCTAssertEqual(mockLLM.receivedModes, [.light, .full])
        XCTAssertEqual(mockLLM.receivedTemplates.last?.map(\.id), [NoteTemplate.email.id])
    }

    func testReprocessOfANoteFromBeforeTemplatesUsesDesignDoc() async {
        let note = VoiceNote(id: UUID(), rawTranscript: "Ship the login fix.", cleanedNote: "### Action Items", actionItems: ["Ship the login fix"], status: .ready)
        repository.save(note)

        await pipeline.reprocessWithLLM(noteId: note.id)

        XCTAssertEqual(mockLLM.receivedTemplates.last?.map(\.id), [NoteTemplate.designDoc.id])
    }

    // MARK: - AI engine unavailable

    func testProcessKeepsTheTranscriptWhenStage2Fails() async {
        mockASR.stubTranscript = "Pick up the dry cleaning before the team dinner on Friday night"
        mockLLM.stubError = LLMCopywriterError.aiEngineUnavailable
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", title: "Processing Voice Note...", status: .syncing)
        repository.save(note)

        await pipeline.process(note: note)

        let saved = repository.note(withId: note.id)
        XCTAssertEqual(saved?.status, .failed)
        XCTAssertEqual(saved?.rawTranscript, "Pick up the dry cleaning before the team dinner on Friday night")
        XCTAssertEqual(saved?.segments.count, 1)
        XCTAssertEqual(saved?.title, "Pick up the dry cleaning before the team…")
        XCTAssertEqual(saved?.errorMessage, LLMCopywriterError.aiEngineUnavailable.errorDescription)
    }

    func testProvisionalTitleUsesTheFirstWords() {
        XCTAssertEqual(NoteProcessingPipeline.provisionalTitle(from: "Short memo"), "Short memo")
        XCTAssertEqual(NoteProcessingPipeline.provisionalTitle(from: "one two three four five six seven eight nine"), "one two three four five six seven eight…")
        XCTAssertNil(NoteProcessingPipeline.provisionalTitle(from: "  "))
    }

    // MARK: - Template change

    func testChangeTemplatePassesOnlyTheChosenTemplateAndReusesTheCleanedText() async throws {
        let email = NoteTemplate.email
        mockLLM.stubTemplateId = email.id
        mockLLM.stubTemplateName = email.name
        let note = VoiceNote(id: UUID(), title: "Launch Update", rawTranscript: "Send the launch update to the team.", cleanedNote: "cleaned", status: .ready, lightCleanedNote: "cleaned", lightCleanupEngine: "mock")
        repository.save(note)

        try await pipeline.changeTemplate(noteId: note.id, to: email)

        XCTAssertTrue(mockASR.receivedVocabulary.isEmpty, "A template change never re-runs ASR")
        XCTAssertEqual(mockLLM.receivedModes, [.full], "The note's cleaned text is reused")
        XCTAssertEqual(mockLLM.receivedTemplates.last?.map(\.id), [email.id])
        let updated = repository.note(withId: note.id)
        XCTAssertEqual(updated?.templateId, email.id)
        XCTAssertEqual(updated?.templateName, email.name)
        XCTAssertEqual(updated?.status, .ready)
        XCTAssertEqual(updated?.cleanedNote, "mock markdown")
        XCTAssertEqual(updated?.cleanedText, "cleaned")
        XCTAssertEqual(updated?.title, "Launch Update", "A template never renames the note")
    }

    func testChangeTemplateToAutoDetectPassesTheEnabledTemplates() async throws {
        let note = VoiceNote(id: UUID(), rawTranscript: "Send the launch update to the team.", cleanedNote: "cleaned", status: .ready, lightCleanedNote: "cleaned")
        repository.save(note)

        try await pipeline.changeTemplate(noteId: note.id, to: nil)

        XCTAssertEqual(mockLLM.receivedTemplates.last?.map(\.id), templateStore.enabledTemplates.map(\.id))
    }

    func testChangeFormatToCleanedTextDropsTheStructuredRewriteWithoutAnLLMCall() async throws {
        let note = VoiceNote(id: UUID(), rawTranscript: "Send the launch update.", cleanedNote: "### Subject", actionItems: ["Send it"], status: .ready, lightCleanedNote: "Send the launch update.", lightCleanupEngine: "mock", templateId: NoteTemplate.email.id, templateName: "Email")
        repository.save(note)

        try await pipeline.changeFormat(noteId: note.id, to: .none)

        XCTAssertTrue(mockLLM.receivedModes.isEmpty)
        let updated = repository.note(withId: note.id)
        XCTAssertEqual(updated?.hasStructuredRewrite, false)
        XCTAssertEqual(updated?.cleanedNote, "Send the launch update.")
        XCTAssertEqual(updated?.actionItems, [])
        XCTAssertNil(updated?.templateId)
    }

    func testChangeTemplateFailureKeepsAReadyNoteAsItWas() async throws {
        let original = VoiceNote(id: UUID(), title: "Launch Update", rawTranscript: "Send the launch update to the team.", cleanedNote: "original markdown", status: .ready, templateName: "Design Doc")
        repository.save(original)
        mockLLM.stubError = LLMCopywriterError.aiEngineUnavailable

        do {
            try await pipeline.changeTemplate(noteId: original.id, to: NoteTemplate.designDoc)
            XCTFail("changeTemplate should rethrow the Stage 2 error")
        } catch {
            XCTAssertEqual(error.localizedDescription, LLMCopywriterError.aiEngineUnavailable.errorDescription)
        }

        let saved = repository.note(withId: original.id)
        XCTAssertEqual(saved?.status, .ready)
        XCTAssertNil(saved?.errorMessage)
        XCTAssertEqual(saved?.cleanedNote, "original markdown")
        XCTAssertEqual(saved?.templateName, "Design Doc")
    }

    func testStructuredFailureOnAFormatChangeKeepsTheNote() async throws {
        let original = VoiceNote(id: UUID(), rawTranscript: "Send the launch update.", cleanedNote: "cleaned", status: .ready, lightCleanedNote: "cleaned")
        repository.save(original)
        mockLLM.stubFullError = LLMCopywriterError.unparsableResponse

        do {
            try await pipeline.changeFormat(noteId: original.id, to: .auto)
            XCTFail("A format change should rethrow the structured rewrite's error")
        } catch {}

        let saved = repository.note(withId: original.id)
        XCTAssertEqual(saved?.status, .ready)
        XCTAssertEqual(saved?.cleanedText, "cleaned")
        XCTAssertEqual(saved?.hasStructuredRewrite, false)
    }

    func testReprocessAfterATemplateChangeKeepsThatTemplate() async throws {
        let note = VoiceNote(id: UUID(), rawTranscript: "Send the launch update to the team.", cleanedNote: "cleaned", status: .ready, lightCleanedNote: "cleaned")
        repository.save(note)
        mockLLM.stubTemplateId = NoteTemplate.designDoc.id
        try await pipeline.changeTemplate(noteId: note.id, to: NoteTemplate.designDoc)

        await pipeline.reprocessWithLLM(noteId: note.id)

        XCTAssertEqual(mockLLM.receivedTemplates.last?.map(\.id), [NoteTemplate.designDoc.id])
    }

    // MARK: - Cleaned text for older notes

    func testGenerateLightCleanupFillsInANoteFromBeforeTheDefault() async {
        let note = VoiceNote(id: UUID(), rawTranscript: "an older note.", cleanedNote: "### Notes", status: .ready, templateId: NoteTemplate.generalNotes.id, templateName: "General Notes")
        repository.save(note)

        await pipeline.generateLightCleanup(noteId: note.id)

        let updated = repository.note(withId: note.id)
        XCTAssertEqual(updated?.lightCleanedNote, "mock light")
        XCTAssertEqual(updated?.cleanedNote, "### Notes", "The structured rewrite is left as it was")
        XCTAssertEqual(mockLLM.receivedModes, [.light])
    }

    func testGenerateLightCleanupDoesNothingWhenNoteIsNotReady() async {
        let note = VoiceNote(id: UUID(), status: .transcribingASR)
        repository.save(note)

        await pipeline.generateLightCleanup(noteId: note.id)

        XCTAssertNil(repository.note(withId: note.id)?.lightCleanedNote)
        XCTAssertTrue(mockLLM.receivedDictionaries.isEmpty)
    }

    func testGenerateLightCleanupDoesNothingWhenAlreadyGenerated() async {
        let note = VoiceNote(id: UUID(), rawTranscript: "already have a transcript.", status: .ready, lightCleanedNote: "already generated", lightCleanupEngine: "mock")
        repository.save(note)

        await pipeline.generateLightCleanup(noteId: note.id)

        XCTAssertEqual(repository.note(withId: note.id)?.lightCleanedNote, "already generated")
        XCTAssertTrue(mockLLM.receivedDictionaries.isEmpty, "should not re-generate an already-present light rewrite")
    }

    func testTemplateChoiceRoundTripsAsAString() throws {
        for choice in [TemplateChoice.none, .auto, .template(NoteTemplate.email.id)] {
            XCTAssertEqual(TemplateChoice(rawValue: choice.rawValue), choice)
            var note = VoiceNote(id: UUID())
            note.templateChoice = choice
            let decoded = try JSONDecoder().decode(VoiceNote.self, from: JSONEncoder().encode(note))
            XCTAssertEqual(decoded.templateChoice, choice)
        }
        XCTAssertNil(TemplateChoice(rawValue: "bogus"))
    }

    // MARK: - Append / Merge (multi-segment notes)

    func testAppendRecordingTranscribesOnlyTheNewAudioAndReprocessesTheFullHistory() async {
        mockASR.stubTranscript = "First idea about the project."
        let note = VoiceNote(id: UUID(), duration: 10, audioFileName: "segment-1.m4a", status: .syncing)
        repository.save(note)
        await pipeline.process(note: note)

        XCTAssertEqual(mockASR.receivedAudioURLs.count, 1)

        mockASR.stubTranscript = "Second idea, a follow-up."
        let secondSegmentId = UUID()
        await pipeline.appendRecording(
            segmentId: secondSegmentId,
            audioFileName: "segment-2.m4a",
            duration: 8,
            source: .phoneApp,
            toNoteId: note.id
        )

        let updated = repository.note(withId: note.id)
        XCTAssertEqual(updated?.segments.count, 2)
        XCTAssertEqual(updated?.segments.last?.id, secondSegmentId)
        XCTAssertEqual(updated?.audioFileName, "segment-2.m4a", "Top-level audioFileName should track the latest segment")

        // Only the new audio was ever handed to ASR -- the first segment's transcript was reused.
        XCTAssertEqual(mockASR.receivedAudioURLs.count, 2)
        XCTAssertTrue(mockASR.receivedAudioURLs.last!.lastPathComponent.contains("segment-2"))

        // Stage 2 saw both segments' text together, not just the newest one.
        let mergedTranscript = mockLLM.receivedTranscripts.last!
        XCTAssertTrue(mergedTranscript.contains("First idea about the project."))
        XCTAssertTrue(mergedTranscript.contains("Second idea, a follow-up."))
        XCTAssertEqual(updated?.status, .ready)
    }

    func testMergeNoteFoldsSourceSegmentsIntoTargetAndDeletesSource() async {
        mockASR.stubTranscript = "Target note's original content."
        let target = VoiceNote(id: UUID(), duration: 12, audioFileName: "target.m4a", status: .syncing)
        repository.save(target)
        await pipeline.process(note: target)

        mockASR.stubTranscript = "A stray idea that belongs with the target."
        let source = VoiceNote(id: UUID(), duration: 6, audioFileName: "source.m4a", status: .syncing)
        repository.save(source)
        await pipeline.process(note: source)

        await pipeline.mergeNote(sourceId: source.id, intoTargetId: target.id)

        XCTAssertNil(repository.note(withId: source.id), "The source note's record should be gone after merging")

        let mergedTarget = repository.note(withId: target.id)
        XCTAssertEqual(mergedTarget?.segments.count, 2)
        XCTAssertEqual(mergedTarget?.status, .ready)

        let mergedTranscript = mockLLM.receivedTranscripts.last!
        XCTAssertTrue(mergedTranscript.contains("Target note's original content."))
        XCTAssertTrue(mergedTranscript.contains("A stray idea that belongs with the target."))
    }

    func testMergeNoteIgnoresRequestWhenSourceHasNoTranscriptYet() async {
        let target = VoiceNote(id: UUID(), rawTranscript: "Ready target.", status: .ready)
        repository.save(target)
        let unprocessedSource = VoiceNote(id: UUID(), status: .syncing)
        repository.save(unprocessedSource)

        await pipeline.mergeNote(sourceId: unprocessedSource.id, intoTargetId: target.id)

        XCTAssertNotNil(repository.note(withId: unprocessedSource.id), "An unprocessed source shouldn't be consumed by a merge")
        XCTAssertEqual(repository.note(withId: target.id)?.segments.count ?? 0, 0, "Target shouldn't change when the merge is rejected")
    }

    // MARK: - Cold-load warm-up

    func testWarmUpStartsBothServicesWarmUpConcurrently() async {
        await pipeline.warmUp().value

        XCTAssertEqual(mockASR.warmUpCallCount, 1)
        XCTAssertEqual(mockLLM.warmUpCallCount, 1)
        // warmUp() must never touch the actual transcription/generation path.
        XCTAssertTrue(mockASR.receivedAudioURLs.isEmpty)
        XCTAssertTrue(mockLLM.receivedTranscripts.isEmpty)
    }

    // MARK: - Streaming Transcript Tests

    func testProcessStreamingTranscriptsEmittedAndCleared() async {
        let note = VoiceNote(id: UUID(), audioFileName: "recording.m4a", status: .syncing)
        repository.save(note)

        mockASR.onProgressEmissions = ["Live piece one", "Live piece one and two"]
        mockASR.stubTranscript = "Live piece one and two completed."

        var observedStreamingValues: [String] = []
        let cancellable = pipeline.$streamingTranscripts.sink { map in
            if let text = map[note.id] {
                observedStreamingValues.append(text)
            }
        }

        await pipeline.process(note: note)

        XCTAssertFalse(observedStreamingValues.isEmpty)
        XCTAssertTrue(observedStreamingValues.contains("Live piece one"))
        XCTAssertTrue(observedStreamingValues.contains("Live piece one and two"))
        // After pipeline completes, the entry should be removed
        XCTAssertNil(pipeline.streamingTranscripts[note.id])
        _ = cancellable
    }

    func testAppendRecordingStreamsProgressAndCleansUp() async {
        let target = VoiceNote(id: UUID(), rawTranscript: "Existing text.", status: .ready)
        repository.save(target)

        mockASR.onProgressEmissions = ["New appended idea"]
        mockASR.stubTranscript = "New appended idea completed."

        var observedStreamingValues: [String] = []
        let cancellable = pipeline.$streamingTranscripts.sink { map in
            if let text = map[target.id] {
                observedStreamingValues.append(text)
            }
        }

        await pipeline.appendRecording(
            segmentId: UUID(),
            audioFileName: "segment.m4a",
            duration: 10,
            source: .phoneApp,
            toNoteId: target.id
        )

        XCTAssertTrue(observedStreamingValues.contains("New appended idea"))
        XCTAssertNil(pipeline.streamingTranscripts[target.id])
        _ = cancellable
    }
}
