import ContempoCore
import Foundation
import Observation
import WidgetKit

/// watchOS port of Android Wear's `WearCaptureViewModel` — record-only
/// capture, no on-device transcription/parsing (see `CLAUDE.md`'s wear
/// section: the watch captures and relays, the phone processes). Two
/// differences from the Android original, both forced by real platform
/// constraints rather than a design choice: progress is a periodic REST
/// fetch instead of a live Firestore listener (see `WatchEntryStatsReader`'s
/// doc comment), and there's no WorkManager equivalent — background upload
/// retry is a `WKApplicationRefreshBackgroundTask` instead (wired in
/// `ContempoWatchApp.swift`), with this view model only owning the
/// immediate, foregrounded attempt.
@Observable
@MainActor
final class WatchCaptureViewModel {
    private let audioRecorder = WatchServiceLocator.audioRecorder
    private let pendingCaptureStore = WatchServiceLocator.pendingCaptureStore
    private let uploadStatsStore = WatchServiceLocator.uploadStatsStore
    private let entryStatsReader = WatchServiceLocator.entryStatsReader
    private let entryWriter = WatchServiceLocator.entryWriter
    private let hoursProgressStore = WatchServiceLocator.hoursProgressStore
    private let timerStore = WatchWorkTimerStore(appGroupId: "group.com.hejitech.contempo")
    private let tripStore = WatchGpsTripStore(appGroupId: "group.com.hejitech.contempo")

    var isRecording = false
    var confirmedHours: Double = 0
    var lastSavedSummary: String?
    var errorMessage: String?
    var pendingCount = 0
    var uploadedTodayCount = 0
    var isUploadingPending = false

    // Active Work Timer State
    var isTimerRunning = false
    var timerTask = "STR General Work"
    var elapsedSeconds = 0

    // Active GPS Trip State
    var isTripActive = false
    var tripElapsedSeconds = 0

    var recordingAmplitude: Float { audioRecorder.amplitude }

    private var statsPollTask: Task<Void, Never>?
    private var timerTickerTask: Task<Void, Never>?
    private var tripTickerTask: Task<Void, Never>?

    init() {
        refreshLocalStats()
        refreshTimerState()
        refreshTripState()
        statsPollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshConfirmedHours()
                try? await Task.sleep(nanoseconds: 15_000_000_000)
            }
        }
    }

    func startWorkTimer(task: String = "STR General Work") {
        timerStore.startWorkTimer(task: task)
        refreshTimerState()
        WatchLiveActivityController.startTimer(subjectName: task, startedAt: timerStore.startedAt() ?? Date())
        WidgetCenter.shared.reloadTimelines(ofKind: "HoursComplication")
    }

    func startGpsTrip() {
        tripStore.startGpsTrip()
        refreshTripState()
        WatchLiveActivityController.startTrip(startedAt: tripStore.startedAt() ?? Date())
        WidgetCenter.shared.reloadTimelines(ofKind: "HoursComplication")
    }

    func stopGpsTrip() {
        WatchLiveActivityController.endTrip()
        guard let completed = tripStore.stopAndCompleteGpsTrip() else {
            tripStore.clearTrip()
            refreshTripState()
            return
        }
        refreshTripState()

        lastSavedSummary = "GPS Trip Logged — \(completed.durationMinutes) mins!"
        WidgetCenter.shared.reloadTimelines(ofKind: "HoursComplication")

        Task {
            _ = try? await entryWriter.saveConfirmedEntry(
                task: "GPS Mileage Trip",
                durationMinutes: completed.durationMinutes,
                category: EntryCategory.other.firestoreValue,
                isTrip: true,
                startedAt: completed.startedAt,
                stoppedAt: completed.stoppedAt
            )
            await refreshConfirmedHours()
        }
    }

    func stopAndCompleteWorkTimer() {
        WatchLiveActivityController.endTimer()
        guard let completed = timerStore.stopAndCompleteWorkTimer() else { return }
        refreshTimerState()
        
        lastSavedSummary = "Work Logged — \(completed.durationMinutes) mins!"
        confirmedHours += Double(completed.durationMinutes) / 60.0
        hoursProgressStore.write(confirmedHours: confirmedHours)
        WidgetCenter.shared.reloadTimelines(ofKind: "HoursComplication")

        Task {
            _ = try? await entryWriter.saveConfirmedEntry(
                task: completed.task,
                durationMinutes: completed.durationMinutes,
                category: EntryCategory.admin.firestoreValue,
                isTrip: false,
                startedAt: completed.startedAt,
                stoppedAt: completed.stoppedAt
            )
            await refreshConfirmedHours()
        }
    }

    private func refreshTimerState() {
        isTimerRunning = timerStore.isTimerRunning()
        timerTask = timerStore.currentTask()
        elapsedSeconds = timerStore.elapsedSeconds()

        timerTickerTask?.cancel()
        if isTimerRunning {
            timerTickerTask = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                    guard let self else { return }
                    self.elapsedSeconds = self.timerStore.elapsedSeconds()
                }
            }
        }
    }

    private func refreshTripState() {
        isTripActive = tripStore.isTripActive()
        tripElapsedSeconds = tripStore.elapsedSeconds()

        tripTickerTask?.cancel()
        if isTripActive {
            tripTickerTask = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                    guard let self else { return }
                    self.tripElapsedSeconds = self.tripStore.elapsedSeconds()
                }
            }
        }
    }

    func hasRecordAudioPermission() async -> Bool {
        await audioRecorder.hasPermission()
    }

    func startRecording() async {
        guard !isRecording, await audioRecorder.hasPermission() else { return }
        errorMessage = nil
        lastSavedSummary = nil
        do {
            try audioRecorder.start()
            isRecording = true
        } catch {
            errorMessage = "Couldn't start recording — try again."
        }
    }

    /// Stop -> WAV-encode -> save locally, done. Doesn't wait on the upload
    /// itself — capture stays instant, and an immediate background sync
    /// attempt kicks off right away (the periodic background refresh task is
    /// the fallback for whenever the watch had no connectivity at record
    /// time).
    func stopRecordingAndSend() async {
        guard isRecording else { return }
        let samples = audioRecorder.stop()
        isRecording = false
        guard !samples.isEmpty else {
            errorMessage = "Didn't catch that — try again."
            return
        }

        let wav = WavAudio.encode(samples: samples, sampleRateHz: Int(WatchAudioRecorder.sampleRateHz))
        pendingCaptureStore.save(wav: wav, lat: nil, lng: nil)
        lastSavedSummary = "Saved — uploading shortly"
        refreshLocalStats()
        Task {
            let result = await PendingCaptureSyncer.syncAll()
            refreshLocalStats()
            if !result.isSuccess {
                errorMessage = result.errorMessage
            }
        }
    }

    /// User-initiated "upload now" — syncs the pending backlog directly for
    /// immediate, visible feedback rather than waiting on the background
    /// refresh task's own schedule.
    func uploadPendingNow() {
        guard !isUploadingPending, pendingCount > 0 else { return }
        isUploadingPending = true
        errorMessage = nil
        lastSavedSummary = nil
        Task {
            let result = await PendingCaptureSyncer.syncAll()
            let stillPending = pendingCaptureStore.listPending().count
            isUploadingPending = false
            pendingCount = stillPending
            uploadedTodayCount = uploadStatsStore.uploadedTodayCount()
            if stillPending == 0 {
                lastSavedSummary = "All uploaded"
            } else {
                errorMessage = !result.errorMessage.isEmpty ? result.errorMessage : "\(stillPending) still pending — check connection"
            }
        }
    }

    func dismissMessages() {
        lastSavedSummary = nil
        errorMessage = nil
    }

    private func refreshLocalStats() {
        pendingCount = pendingCaptureStore.listPending().count
        uploadedTodayCount = uploadStatsStore.uploadedTodayCount()
    }

    private func refreshConfirmedHours() async {
        let hours = await entryStatsReader.confirmedHours()
        confirmedHours = hours
        hoursProgressStore.write(confirmedHours: hours)
        WidgetCenter.shared.reloadTimelines(ofKind: "HoursComplication")
    }
}
