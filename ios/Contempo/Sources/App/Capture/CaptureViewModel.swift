import ContempoCore
import ContempoFirestore
import FirebaseFirestore
import Foundation
import Observation

/// Typed-entry, voice-capture, and photo/odometer capture paths, plus manual
/// timer/GPS-trip toggles. Quick Capture (background WAV queue bypassing
/// transcribe/parse) and timer/trip voice-intent classification (starting/
/// stopping a timer by saying "starting work on X" / "stop") are deferred to
/// a later pass — only the manual "More ways to capture" menu equivalents
/// are wired here.
@Observable
@MainActor
final class CaptureViewModel {
    private let agentClient = ServiceLocator.agentClient
    private let entryRepository = ServiceLocator.entryRepository
    private let audioRecorder = ServiceLocator.audioRecorder
    private let whisperTranscriber = ServiceLocator.whisperTranscriber
    private let timerEntryCoordinator = ServiceLocator.timerEntryCoordinator
    private let mileageTripCoordinator = ServiceLocator.mileageTripCoordinator
    private let mileageTracker = ServiceLocator.mileageTracker
    private let captureLanguageStore = ServiceLocator.captureLanguageStore

    private let quickCaptureSettingsStore = ServiceLocator.quickCaptureSettingsStore
    private let quickCaptureStatsStore = ServiceLocator.quickCaptureStatsStore
    private let pendingCaptureStore = ServiceLocator.pendingCaptureStore

    var quickCaptureEnabled: Bool {
        get { quickCaptureSettingsStore.enabled }
        set { quickCaptureSettingsStore.setEnabled(newValue) }
    }

    var quickCaptureStatus: QuickCaptureStatusUiState {
        QuickCaptureStatusUiState(
            pendingCount: pendingCaptureStore.pendingTodayCount,
            completedTodayCount: quickCaptureStatsStore.completedTodayCount,
            processingStage: AudioCaptureProcessor.shared.currentlyProcessingStage
        )
    }

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

    var isDraftingFromPhoto = false
    var isProcessingOdometerPhoto = false
    /// Transient status for the odometer capture path (no Confirm screen to
    /// land on — it starts/ends a trip directly) — mirrors Android's
    /// `CaptureUiState.tripMessage`.
    var tripMessage: String?

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

    /// Discards the open work timer entirely — for a "started by mistake" /
    /// changed-my-mind cancel, distinct from `completeOpenTimer` which
    /// always finalizes an entry.
    func cancelWork() {
        Task {
            _ = try? await timerEntryCoordinator.handleCancel()
            LiveActivityController.endTimer()
        }
    }

    /// Pause/resume the open work timer.
    func pauseWork() {
        Task {
            let pausedAt = Date()
            _ = try? await timerEntryCoordinator.handlePause(pausedAt: Timestamp(date: pausedAt))
            LiveActivityController.pauseTimer(pausedAt: pausedAt, pausedDurationSeconds: Double(openTimerEntry?.pausedDurationSeconds ?? 0))
        }
    }

    func resumeWork() {
        Task {
            guard let pausedSince = openTimerEntry?.pausedAt?.dateValue() else { return }
            let resumedAt = Date()
            let newPausedDurationSeconds = Double(openTimerEntry?.pausedDurationSeconds ?? 0) + resumedAt.timeIntervalSince(pausedSince)
            _ = try? await timerEntryCoordinator.handleResume(resumedAt: Timestamp(date: resumedAt))
            LiveActivityController.resumeTimer(pausedDurationSeconds: newPausedDurationSeconds)
        }
    }

    /// Pause/resume the open trip. A GPS trip's distance/pause state is owned
    /// locally by `MileageTracker` (mirrors Android's
    /// `MileageTrackingService`), so pausing must go through it rather than
    /// the coordinator directly — otherwise the tracker keeps summing
    /// distance covered while "paused" and re-writes it on the next fix,
    /// silently undoing the pause. An odometer trip has no tracker running,
    /// so it's safe to call the coordinator directly there.
    func pauseTrip() {
        Task {
            if gpsTripOpen {
                await mileageTracker.pause()
            } else {
                _ = try? await mileageTripCoordinator.handlePauseTrip(pausedAt: Timestamp(date: Date()))
            }
        }
    }

    func resumeTrip() {
        Task {
            if gpsTripOpen {
                await mileageTracker.resume()
            } else {
                _ = try? await mileageTripCoordinator.handleResumeTrip(resumedAt: Timestamp(date: Date()))
            }
        }
    }

    /// Discards the open trip entirely — a GPS trip must route through
    /// `MileageTracker.cancel()` so it stops location updates and skips
    /// writing a finalized entry (see `pauseTrip`'s doc comment for why GPS
    /// trips can't be mutated directly while the tracker owns them); an
    /// odometer trip has no running tracker, so the coordinator is called
    /// directly.
    func cancelTrip() {
        Task {
            if gpsTripOpen {
                await mileageTracker.cancel()
            } else {
                _ = try? await mileageTripCoordinator.handleCancelTrip()
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
            errorMessage = "Didn't catch any words — hold the mic button and speak."
            return
        }

        isTranscribing = false
        await parseAndHold(rawTranscript, captureSource: .voice)
    }

    /// Quick Capture mode: saves recorded WAV bytes to disk immediately,
    /// returns the UI to idle state instantly, and triggers background sync.
    func stopQuickCaptureAndSave() {
        guard isRecording else { return }
        isRecording = false
        let samples = audioRecorder.stop()
        let wavData = WavAudio.encode(samples: samples, sampleRateHz: WhisperTranscriber.sampleRateHz)

        pendingCaptureStore.save(
            wavData: wavData,
            language: captureLanguageStore.selected
        )

        Task {
            await PendingCaptureSyncer.syncAll()
            await AudioCaptureProcessor.shared.processPendingCaptures()
        }
    }

    func processQuickCaptureBacklogNow() {
        Task {
            await PendingCaptureSyncer.syncAll()
            await AudioCaptureProcessor.shared.processPendingCaptures()
        }
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

    /// Odometer start/end writes straight to Firestore and never reaches
    /// Confirm — this transient banner is the only feedback, so it
    /// self-clears rather than lingering (see CaptureScreen's `.task(id:)`).
    func dismissTripMessage() {
        tripMessage = nil
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

    /// A just-taken photo meant to become a whole entry (vs. [logOdometerPhoto]'s
    /// single-number read) — mirrors Android's `CaptureViewModel.processPhoto`.
    /// The photo is carried through to Confirm as evidence regardless of how
    /// well the draft parsed, same as the text/voice paths never drop what
    /// the user captured just because parsing came back thin.
    func processPhoto(imageData: Data, onDrafted: @escaping (ConfirmParams) -> Void) {
        isDraftingFromPhoto = true
        errorMessage = nil
        Task {
            let outcome = await agentClient.draftEntryFromPhoto(imageData: imageData, knownProperties: knownProperties)
            isDraftingFromPhoto = false
            switch outcome {
            case .success(let result):
                onDrafted(ConfirmParams(
                    property: result.draft.property ?? "",
                    task: result.draft.task ?? "",
                    durationMinutes: result.draft.durationMinutes ?? 0,
                    category: result.draft.category ?? EntryCategory.other.firestoreValue,
                    captureSource: .photo,
                    miles: result.draft.miles ?? 0,
                    resolvedActivityDateIso: result.draft.resolvedActivityDateIso,
                    photoData: imageData
                ))
            case .failure(let message):
                errorMessage = message
            }
        }
    }

    /// A photo of an odometer reading — auto-detected the same way as the
    /// voice timer's start/stop: no open trip means this reading starts one,
    /// one already open means this reading closes it. Mirrors Android's
    /// `CaptureViewModel.logOdometerPhoto`.
    func logOdometerPhoto(imageData: Data) {
        isProcessingOdometerPhoto = true
        errorMessage = nil
        Task {
            let outcome = await agentClient.readOdometerFromPhoto(imageData: imageData)
            isProcessingOdometerPhoto = false
            switch outcome {
            case .success(let miles, _):
                if openTripEntry == nil {
                    _ = try? await mileageTripCoordinator.handleStartTrip(
                        property: nil,
                        task: nil,
                        category: nil,
                        source: .photo,
                        startedAt: Timestamp(date: Date()),
                        captureMethod: "photo",
                        odometerStart: miles
                    )
                    tripMessage = "Trip started — odometer \(miles)"
                } else {
                    let result = try? await mileageTripCoordinator.handleEndTrip(
                        endedAt: Timestamp(date: Date()),
                        captureMethod: "photo",
                        odometerEnd: miles
                    )
                    if case .ended(_, let endMiles) = result {
                        tripMessage = "Trip ended — logged \(endMiles) mi"
                    } else {
                        tripMessage = "Couldn't close the trip — try again."
                    }
                }
            case .failure(let message):
                errorMessage = message
            }
        }
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
