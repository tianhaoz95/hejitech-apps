import ContempoCore
import ContempoFirestore
import FirebaseFirestore
import Foundation
import Observation

/// Typed-entry and voice-capture paths, plus manual timer/GPS-trip toggles.
/// Photo/odometer capture still need a camera-driven UI wired up (the
/// underlying `AgentClient.draftEntryFromPhoto`/`readOdometerFromPhoto`
/// already exist), so those affordances stay disabled for now. Quick Capture
/// (background WAV queue bypassing transcribe/parse) and timer/trip
/// voice-intent classification (starting/stopping a timer by saying
/// "starting work on X" / "stop") are deferred to a later pass — only the
/// manual "Other" menu equivalents are wired here.
@Observable
@MainActor
final class CaptureViewModel {
    private let agentClient = ServiceLocator.agentClient
    private let entryRepository = ServiceLocator.entryRepository
    private let audioRecorder = ServiceLocator.audioRecorder
    private let whisperTranscriber = ServiceLocator.whisperTranscriber
    private let timerEntryCoordinator = ServiceLocator.timerEntryCoordinator
    private let mileageTracker = ServiceLocator.mileageTracker
    private let captureLanguageStore = ServiceLocator.captureLanguageStore

    var showLanguageSelector: Bool { captureLanguageStore.showLanguageSelector }
    var selectedCaptureLanguage: CaptureLanguage {
        get { captureLanguageStore.selected }
        set { captureLanguageStore.setSelected(newValue) }
    }

    var inputText = ""
    var isRecording = false
    var isTranscribing = false
    var isParsing = false
    var errorMessage: String?
    var parsingStage: ParsingStage = .idle
    /// The cleaned-up task text shown on the "here's what we heard" card —
    /// non-nil only while waiting for the user's manual tap-to-continue.
    var finalizedTranscript: String?

    /// The one open start/stop timer, if any — own stream from Dashboard's
    /// (rather than sharing it), same as Android's `CaptureViewModel` keeps
    /// its own `openTimerEntry`/`openTripEntry` `StateFlow`s independent of
    /// `DashboardViewModel`'s.
    var openTimerEntry: Entry?
    /// The one open mileage trip, if any. Scoped by `isTrip` so it and
    /// `openTimerEntry` never match the same entry.
    var openTripEntry: Entry?
    var gpsTripOpen: Bool { openTripEntry?.mileageCaptureMethod == "gps" }

    private var knownProperties: [String] = []
    private var pendingResult: ConfirmParams?

    var recordingAmplitude: Float { audioRecorder.amplitude }

    init() {
        let repository = entryRepository
        // Weak self + a self-check inside the loop (rather than cancelling
        // from `deinit`, which can't touch this actor-isolated class's
        // stored properties) — the task quietly stops updating and exits
        // next time the stream yields once this view model is gone.
        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeProperties() }
            )
            do {
                for try await properties in stream {
                    guard let self else { return }
                    self.knownProperties = properties.map(\.name)
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
        }
        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeEntries() }
            )
            do {
                for try await entries in stream {
                    guard let self else { return }
                    self.openTimerEntry = entries.first { $0.inProgress && !$0.isTrip }
                    self.openTripEntry = entries.first { $0.inProgress && $0.isTrip }
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
        }
    }

    /// Manual "Start new work" from the "Other" menu — the tap-triggered
    /// equivalent of a "starting to work on X" voice utterance. Property/task
    /// are left blank (filled in later via Confirm, reached from the
    /// ongoing-work banner or Dashboard); `handleStart` already auto-closes
    /// whatever timer was previously open, so this is safe to call
    /// unconditionally even if one happens to already be running.
    func startNewWork() {
        Task {
            _ = try? await timerEntryCoordinator.handleStart(
                property: nil, task: nil, category: nil, source: .manual, startedAt: Timestamp(date: Date())
            )
            LiveActivityController.startTimer(subjectName: "Work in progress", startedAt: Date())
        }
    }

    /// Tap-to-complete for the ongoing-work banner — the manual-tap
    /// equivalent of saying "stop."
    func completeOpenTimer() {
        Task {
            let stopped = try? await timerEntryCoordinator.handleStop(property: nil, task: nil, stoppedAt: Timestamp(date: Date()))
            if stopped != nil {
                LiveActivityController.endTimer()
            }
        }
    }

    /// The "Other" menu's GPS trip toggle — starts/stops `MileageTracker`,
    /// which owns the trip Entry's full lifecycle end to end (see its doc
    /// comment), same division of responsibility as Android's
    /// `MileageTrackingService`.
    func toggleGpsTrip() {
        Task {
            if mileageTracker.isTracking {
                await mileageTracker.stop()
            } else {
                await mileageTracker.start()
            }
        }
    }

    func startRecording() async {
        guard !isRecording else { return }
        guard await audioRecorder.hasPermission() else {
            errorMessage = "Microphone access is off — enable it in Settings to capture by voice."
            return
        }
        errorMessage = nil
        do {
            try audioRecorder.start()
            isRecording = true
        } catch {
            errorMessage = "Couldn't start recording — try again."
        }
    }

    /// Stop -> on-device Whisper transcribe -> straight into parsing, held
    /// (not handed to `onDrafted`) until the user taps to confirm what was
    /// heard — see `confirmTranscript`.
    func stopRecordingAndProcess() async {
        guard isRecording else { return }
        isRecording = false
        isTranscribing = true

        let samples = audioRecorder.stop()
        let rawTranscript = await whisperTranscriber.transcribe(samples: samples, language: captureLanguageStore.selected)

        guard !rawTranscript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            isTranscribing = false
            errorMessage = "Didn't catch that — try again."
            return
        }

        inputText = rawTranscript
        isTranscribing = false
        await parseAndHold(rawTranscript, captureSource: .voice)
    }

    /// The manual "looks right, continue" step after `stopRecordingAndProcess`.
    func confirmTranscript(onDrafted: @escaping (ConfirmParams) -> Void) {
        guard let result = pendingResult else { return }
        pendingResult = nil
        finalizedTranscript = nil
        inputText = ""
        onDrafted(result)
    }

    /// Discards a held transcript instead of confirming it — e.g. "try again."
    func discardTranscript() {
        pendingResult = nil
        finalizedTranscript = nil
        inputText = ""
    }

    func submit(onDrafted: @escaping (ConfirmParams) -> Void) {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isParsing = true
        errorMessage = nil
        Task {
            let outcome = await agentClient.parseEntry(rawText: text, knownProperties: knownProperties) { [weak self] stage in
                self?.parsingStage = stage
            }
            isParsing = false
            parsingStage = .idle
            switch outcome {
            case .success(let result):
                inputText = ""
                onDrafted(ConfirmParams(
                    property: result.draft.property ?? "",
                    task: result.draft.task ?? text,
                    durationMinutes: result.draft.durationMinutes ?? 0,
                    category: result.draft.category ?? EntryCategory.other.firestoreValue,
                    captureSource: .text,
                    miles: result.draft.miles ?? 0,
                    resolvedActivityDateIso: result.draft.resolvedActivityDateIso
                ))
            case .failure(let message):
                errorMessage = message
            }
        }
    }

    /// Bypasses parsing entirely — the user typing every field by hand.
    func manualEntry(onDrafted: @escaping (ConfirmParams) -> Void) {
        onDrafted(ConfirmParams(captureSource: .manual))
    }

    private func parseAndHold(_ text: String, captureSource: CaptureSource) async {
        isParsing = true
        errorMessage = nil
        let outcome = await agentClient.parseEntry(rawText: text, knownProperties: knownProperties) { [weak self] stage in
            self?.parsingStage = stage
        }
        isParsing = false
        parsingStage = .idle
        switch outcome {
        case .success(let result):
            let params = ConfirmParams(
                property: result.draft.property ?? "",
                task: result.draft.task ?? text,
                durationMinutes: result.draft.durationMinutes ?? 0,
                category: result.draft.category ?? EntryCategory.other.firestoreValue,
                captureSource: captureSource,
                miles: result.draft.miles ?? 0,
                resolvedActivityDateIso: result.draft.resolvedActivityDateIso
            )
            pendingResult = params
            finalizedTranscript = (result.draft.task?.isEmpty == false) ? result.draft.task : text
        case .failure(let message):
            errorMessage = message
        }
    }
}
