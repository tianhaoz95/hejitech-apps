import XCTest
@testable import Voxbrief

final class PipelineTimelineTests: XCTestCase {
    private func note(_ status: NoteProcessingStatus, transcript: String = "", configure: (inout VoiceNote) -> Void = { _ in }) -> VoiceNote {
        var note = VoiceNote(id: UUID(), audioFileName: "a.m4a", status: status)
        note.rawTranscript = transcript
        configure(&note)
        return note
    }

    private func kinds(_ steps: [PipelineTimelineStep]) -> [PipelineTimelineStep.Kind] { steps.map(\.kind) }
    private func states(_ steps: [PipelineTimelineStep]) -> [PipelineTimelineStep.State] { steps.map(\.state) }

    func testAMemoBeingCleanedUpShowsEveryStepItRuns() {
        let progress = ChunkProgress(step: LLMCopywriterService.cleanupStep, done: 3, total: 8)
        let steps = PipelineTimeline.steps(
            for: note(.cleaningLLM, transcript: "Hello") { $0.speakerCount = 1 },
            progress: progress, isLive: true, skipsBrief: false
        )
        XCTAssertEqual(kinds(steps), [.transcribe, .speakers, .cleanup, .brief])
        XCTAssertEqual(states(steps), [.done, .done, .active, .pending])
        XCTAssertEqual(steps[2].progress, progress)
        XCTAssertEqual(steps[2].fraction, 3.0 / 8.0, accuracy: 0.0001)
    }

    func testAConversationAddsSpeakerTurnsAndAFormatAddsStructure() {
        let steps = PipelineTimeline.steps(
            for: note(.cleaningLLM, transcript: "Hi") {
                $0.speakerCount = 2
                $0.templateChoice = .auto
            },
            progress: ChunkProgress(step: LLMCopywriterService.turnsStep, done: 1, total: 3),
            isLive: true, skipsBrief: false
        )
        XCTAssertEqual(kinds(steps), [.transcribe, .speakers, .cleanup, .brief, .turns, .structure])
        XCTAssertEqual(states(steps), [.done, .done, .done, .done, .active, .pending])
        XCTAssertEqual(steps[2].title, "Write the Account")
    }

    func testAnInterruptedRunIsPausedWhereItStopped() {
        let steps = PipelineTimeline.steps(
            for: note(.cleaningLLM, transcript: "Hello"),
            progress: ChunkProgress(step: LLMCopywriterService.briefStep, done: 2, total: 5),
            isLive: false, skipsBrief: false
        )
        XCTAssertEqual(steps.first { $0.kind == .brief }?.state, .paused)
    }

    func testDictationSkipsSpeakersAndTheBrief() {
        let steps = PipelineTimeline.steps(
            for: note(.transcribingASR),
            progress: ChunkProgress(step: NoteProcessingPipeline.transcribeStep, done: 0, total: 0),
            isLive: true, skipsBrief: true
        )
        XCTAssertEqual(kinds(steps), [.transcribe, .cleanup])
        XCTAssertEqual(states(steps), [.active, .pending])
    }

    func testAReadyNoteShowsTheStepsItRanWithTheirTimes() {
        let steps = PipelineTimeline.steps(
            for: note(.ready, transcript: "Hello") {
                $0.cleanedNote = "Hello."; $0.lightCleanedNote = "Hello."
                $0.processingTimings = [
                    ProcessingTiming(name: "Transcribe", seconds: 4),
                    ProcessingTiming(name: "Speakers", seconds: 2),
                    ProcessingTiming(name: "Clean up", seconds: 10),
                    ProcessingTiming(name: "Title & summary (3 parts)", seconds: 6),
                ]
                $0.speakerCount = 1
            },
            progress: nil, isLive: false, skipsBrief: false
        )
        XCTAssertEqual(kinds(steps), [.transcribe, .speakers, .cleanup, .brief])
        XCTAssertEqual(states(steps), [.done, .done, .done, .done])
        XCTAssertEqual(steps.map(\.seconds), [4, 2, 10, 6])
    }

    func testAFailedCleanupIsMarkedAndLaterStepsWait() {
        let steps = PipelineTimeline.steps(
            for: note(.failed, transcript: "Hello") {
                $0.processingTimings = [ProcessingTiming(name: "Transcribe", seconds: 4)]
            },
            progress: nil, isLive: false, skipsBrief: false
        )
        XCTAssertEqual(kinds(steps), [.transcribe, .cleanup])
        XCTAssertEqual(states(steps), [.done, .failed])
    }

    func testAFailedStructuredRewriteIsMarkedOnAReadyNote() {
        let steps = PipelineTimeline.steps(
            for: note(.ready, transcript: "Hello") {
                $0.cleanedNote = "Hello."; $0.lightCleanedNote = "Hello."
                $0.templateChoice = .auto
            },
            progress: nil, isLive: false, skipsBrief: false
        )
        XCTAssertEqual(steps.last?.kind, .structure)
        XCTAssertEqual(steps.last?.state, .failed)
    }

    func testTimeLeftWording() {
        XCTAssertEqual(PipelineTimeFormat.left(2), "Almost done")
        XCTAssertEqual(PipelineTimeFormat.left(42), "About 40 s left")
        XCTAssertEqual(PipelineTimeFormat.left(170), "About 3 min left")
        XCTAssertEqual(PipelineTimeFormat.duration(185), "3 min 05 s")
    }
}
