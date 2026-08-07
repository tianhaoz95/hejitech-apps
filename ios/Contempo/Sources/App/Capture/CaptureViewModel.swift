import ContempoCore
import ContempoFirestore
import FirebaseFirestore
import Foundation
import Observation

/// Typed-entry, voice-capture, and unified photo capture paths, plus manual
/// timer/GPS-trip toggles. Photo capture is a single entry point — the
/// vision model classifies odometer-reading vs. work evidence after the
/// photo is taken (see `processCapturedPhoto`) rather than the host picking
/// between two separate photo actions up front. Quick Capture (background
/// WAV queue bypassing transcribe/parse) and timer/trip voice-intent
/// classification (starting/stopping a timer by saying "starting work on X"
/// / "stop") are deferred to a later pass — only the manual quick-action
/// equivalents are wired here.
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

    /// Covers the whole classify -> dispatch sequence for a just-taken photo
    /// (see `processCapturedPhoto`) — one busy state for one camera launch,
    /// regardless of which of the two downstream paths (odometer/work) the
    /// classifier picks.
    var isProcessingPhoto = false

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

    /// A just-taken photo — the single entry point for both photo-capture
    /// paths. Classifies the photo (see `AgentClient.classifyPhotoIntent`)
    /// and dispatches to whichever of the two existing, unchanged
    /// AgentClient methods applies, so the host no longer has to pick
    /// "Photo" vs. "Odometer" before taking the picture.
    func processCapturedPhoto(imageData: Data, onDrafted: @escaping (ConfirmParams) -> Void) {
        isProcessingPhoto = true
        errorMessage = nil
        Task {
            switch await agentClient.classifyPhotoIntent(imageData: imageData) {
            case .success(let intent, _):
                switch intent {
                case .odometer: await handleOdometerPhoto(imageData: imageData, onDrafted: onDrafted)
                case .work: await handleWorkPhoto(imageData: imageData, onDrafted: onDrafted)
                }
            case .failure:
                // Classification itself failed (model unavailable/unclear) —
                // fall back to the general work-entry draft path rather than
                // stranding the user; that path already has a robust
                // "couldn't draft, still attached as evidence, fill in
                // manually" story.
                await handleWorkPhoto(imageData: imageData, onDrafted: onDrafted)
            }
        }
    }

    /// The photo is carried through to Confirm as evidence regardless of how
    /// well the draft parsed, same as the text/voice paths never drop what
    /// the user captured just because parsing came back thin.
    private func handleWorkPhoto(imageData: Data, onDrafted: @escaping (ConfirmParams) -> Void) async {
        let outcome = await agentClient.draftEntryFromPhoto(imageData: imageData, knownProperties: knownProperties)
        isProcessingPhoto = false
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

    /// A photo classified as an odometer reading. Unlike the old
    /// `logOdometerPhoto`, this never writes to Firestore directly — it
    /// always routes to Confirm (in trip mode) so a wrong classification is
    /// correctable there instead of a silent hard commit. Start vs. end is
    /// still auto-detected the same way as before: no open trip means this
    /// reading starts one, one already open means this reading closes it —
    /// Confirm's `saveTrip` re-derives this again at save time regardless,
    /// since time may have passed while the user was reviewing.
    private func handleOdometerPhoto(imageData: Data, onDrafted: @escaping (ConfirmParams) -> Void) async {
        let tripIsEndingExistingTrip = openTripEntry != nil
        let readOutcome = await agentClient.readOdometerFromPhoto(imageData: imageData)
        let reading: Double?
        if case .success(let miles, _) = readOutcome {
            reading = miles
        } else {
            // OCR failing doesn't dead-end here (unlike the old direct-write
            // path's error message) — the classifier still said "odometer,"
            // so Confirm opens in trip mode with a blank, manually-fillable
            // reading.
            reading = nil
        }
        isProcessingPhoto = false
        onDrafted(ConfirmParams(
            captureSource: .photo,
            photoData: imageData,
            isTripCapture: true,
            tripIsEndingExistingTrip: tripIsEndingExistingTrip,
            odometerReading: reading
        ))
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
