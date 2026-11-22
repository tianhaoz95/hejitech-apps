import Foundation

/// One step of a note's processing as the Pipeline tab's timeline shows it: the steps
/// `NoteProcessingPipeline` really runs, in order, each with where it stands, how long it took
/// and, for the step running now, its parts.
struct PipelineTimelineStep: Identifiable, Equatable {
    enum Kind: String, CaseIterable {
        case transcribe, speakers, topics, cleanup, brief, turns, structure

        /// The step name `ChunkProgress` reports for it.
        var progressStep: String {
            switch self {
            case .transcribe: return NoteProcessingPipeline.transcribeStep
            case .speakers: return NoteProcessingPipeline.speakersStep
            case .topics: return NoteProcessingPipeline.topicsStep
            case .cleanup: return LLMCopywriterService.cleanupStep
            case .brief: return LLMCopywriterService.briefStep
            case .turns: return LLMCopywriterService.turnsStep
            case .structure: return LLMCopywriterService.structureStep
            }
        }

        init?(progressStep: String) {
            guard let kind = Kind.allCases.first(where: { $0.progressStep == progressStep }) else { return nil }
            self = kind
        }
    }

    enum State: Equatable {
        case pending, active, paused, done, failed
    }

    let kind: Kind
    var state: State
    /// How long the step took in the note's last run, when it was timed.
    var seconds: Double?
    /// The running (or paused) step's parts.
    var progress: ChunkProgress?
    /// The note is a conversation (two or more speakers): the cleanup writes an account of it.
    var isConversation = false
    /// The note is split into topics: the cleanup and the brief run once per topic.
    var hasTopics = false

    var id: Kind { kind }

    var title: String {
        switch kind {
        case .transcribe: return "Transcribe"
        case .speakers: return "Find Speakers"
        case .topics: return "Find Topics"
        case .cleanup: return isConversation ? "Write the Account" : "Clean Up"
        case .brief: return "Title & Summary"
        case .turns: return "Speaker Turns"
        case .structure: return "Structure"
        }
    }

    var detail: String {
        switch kind {
        case .transcribe: return "Turns the recording into a word-for-word transcript."
        case .speakers: return "Works out who spoke when."
        case .topics: return "Splits a long recording where the subject changes."
        case .cleanup:
            return isConversation
                ? "Writes a readable account of the conversation."
                : "Fixes typos, grammar and filler words, keeping your wording."
        case .brief: return hasTopics ? "Writes each topic's title and one-line summary." : "Writes the note's title and one-line summary."
        case .turns: return "Proofreads what each person said, for the chat view."
        case .structure: return "Rewrites the note into its format's sections."
        }
    }

    var icon: String {
        switch kind {
        case .transcribe: return "waveform"
        case .speakers: return "person.2.wave.2"
        case .topics: return "list.bullet.indent"
        case .cleanup: return "sparkles"
        case .brief: return "text.badge.star"
        case .turns: return "bubble.left.and.bubble.right"
        case .structure: return "list.bullet.rectangle"
        }
    }

    /// "piece" for a watch recording's pieces, else "part".
    var unit: String { kind == .transcribe ? "piece" : "part" }

    /// How far the step is, 0...1: parts done for a running step that counts them.
    var fraction: Double {
        switch state {
        case .done: return 1
        case .active, .paused: return progress?.fraction ?? 0
        case .pending, .failed: return 0
        }
    }
}

enum PipelineTimeline {
    /// The steps a note goes (or went) through, in order, with where each stands. `progress` is
    /// the step reported now (`isLive`) or saved by an interrupted run; `skipsBrief` is a
    /// dictation capture, which skips speakers and the brief.
    static func steps(
        for note: VoiceNote,
        progress: ChunkProgress?,
        isLive: Bool,
        skipsBrief: Bool,
        isReprocessing: Bool = false
    ) -> [PipelineTimelineStep] {
        let timings = note.processingTimings
        let processing = note.status.isProcessing || isLive || isReprocessing
        let progressKind = progress.flatMap { PipelineTimelineStep.Kind(progressStep: $0.step) }
        let conversation = (note.speakerCount ?? 0) >= 2 && note.segments.count <= 1

        func timed(_ matches: (String) -> Bool) -> Double? {
            let found = timings.filter { matches($0.name) }
            return found.isEmpty ? nil : found.map(\.seconds).reduce(0, +)
        }
        let known: [(PipelineTimelineStep.Kind, (String) -> Bool)] = [
            (.transcribe, { $0.hasPrefix("Transcribe") }),
            (.speakers, { $0 == NoteProcessingPipeline.speakerTimingName }),
            (.topics, { $0.hasPrefix("Topics") }),
            (.cleanup, { $0 == "Clean up" }),
            (.brief, { $0.hasPrefix("Title & summary") }),
            (.turns, { $0.hasPrefix("Speaker turns") }),
        ]
        var seconds: [PipelineTimelineStep.Kind: Double] = [:]
        for (kind, matches) in known {
            seconds[kind] = timed(matches)
        }
        // A structured rewrite's own calls (its parts, sections) are the rest.
        seconds[.structure] = timed { name in !known.contains { $0.1(name) } }

        // Which steps this note runs.
        var kinds: [PipelineTimelineStep.Kind] = [.transcribe]
        let speakersRun = !skipsBrief && (processing || note.speakerCount != nil || seconds[.speakers] != nil)
        if speakersRun || progressKind == .speakers { kinds.append(.speakers) }
        let hasTopics = !note.topics.isEmpty || seconds[.topics] != nil
        if hasTopics || progressKind == .topics { kinds.append(.topics) }
        kinds.append(.cleanup)
        if (!skipsBrief && processing) || seconds[.brief] != nil || progressKind == .brief { kinds.append(.brief) }
        if conversation || seconds[.turns] != nil || progressKind == .turns { kinds.append(.turns) }
        if note.templateChoice != nil || note.hasStructuredRewrite || progressKind == .structure {
            kinds.append(.structure)
        }

        var steps = kinds.map { kind in
            PipelineTimelineStep(kind: kind, state: .pending, seconds: seconds[kind], isConversation: conversation, hasTopics: hasTopics)
        }

        func mark(upTo index: Int, as state: PipelineTimelineStep.State) {
            for i in steps.indices {
                steps[i].state = i < index ? .done : (i == index ? state : .pending)
                if i >= index { steps[i].seconds = nil }
            }
        }

        if processing {
            let current: PipelineTimelineStep.Kind
            if let progressKind {
                current = progressKind
            } else if note.status == .transcribingASR || (note.rawTranscript.isEmpty && !isReprocessing) {
                current = .transcribe
            } else {
                current = .cleanup
            }
            let index = steps.firstIndex { $0.kind == current } ?? 0
            let waiting = note.status == .syncing || note.status == .recordedOnWatch
            if waiting && progressKind == nil {
                mark(upTo: 0, as: .pending)
            } else {
                mark(upTo: index, as: isLive || progressKind == nil ? .active : .paused)
                if progressKind != nil { steps[index].progress = progress }
            }
        } else if note.status == .failed {
            let failedKind: PipelineTimelineStep.Kind = note.rawTranscript.isEmpty ? .transcribe : .cleanup
            let failed = note.rawTranscript.isEmpty || note.cleanedText == nil
            if failed, let index = steps.firstIndex(where: { $0.kind == failedKind }) {
                mark(upTo: index, as: .failed)
            } else {
                for i in steps.indices { steps[i].state = .done }
            }
        } else if note.status == .ready {
            for i in steps.indices {
                // A structured rewrite that failed keeps its request, and offers Try Again.
                let structureFailed = steps[i].kind == .structure && !note.hasStructuredRewrite
                steps[i].state = structureFailed ? .failed : .done
            }
        }
        return steps
    }
}
