import Foundation
import AVFoundation
import Combine
import UserNotifications
import WatchKit

/// The watch's recorder, built to run for hours on as little battery as it can:
///
/// - It keeps recording after the wrist drops (the `audio` background mode; the recording has to
///   start while the app is in front).
/// - While nobody is looking it runs no display timer and no metering. The only scheduled work is
///   one housekeeping tick every five minutes.
/// - A recording is saved as a run of pieces (`WatchRecordingConfig.segmentMinutes`), each its own
///   note, so a crash or a flat battery costs one piece at most. The next piece starts before the
///   previous one is closed, so nothing is lost between them.
/// - A call or Siri takes the microphone away. The piece is closed, and the recording picks up
///   again when the microphone comes back or the app is next opened; a notification asks for that.
/// - Pieces are held on the watch until the recording stops (see `WatchSyncService`).
@MainActor
public final class WatchAudioRecorder: NSObject, ObservableObject {
    public static let shared = WatchAudioRecorder()

    /// True from start to stop, including while paused or interrupted.
    @Published public private(set) var isRecording: Bool = false
    @Published public private(set) var isPaused: Bool = false
    /// The system took the microphone (a call, Siri) and the recording has not picked up again.
    @Published public private(set) var isInterrupted: Bool = false
    /// Updated only while the screen is live (`setLiveUI(true)`).
    @Published public private(set) var recordingDuration: TimeInterval = 0
    @Published public private(set) var audioLevel: Float = 0.0
    @Published public private(set) var sessionStartedAt: Date?

    private struct Segment {
        let noteId: UUID
        let url: URL
        let index: Int
    }

    private var audioRecorder: AVAudioRecorder?
    private var segment: Segment?
    private var sessionId: UUID?
    /// The recording in progress, if any. Its pieces are not announced to the iPhone as a
    /// finished recording until it stops.
    public var activeSessionId: UUID? { isRecording ? sessionId : nil }
    private var source: NoteSource = .watchApp
    private var config: WatchRecordingConfig = .default
    /// Recorded time in the pieces already closed.
    private var elapsedBeforeSegment: TimeInterval = 0

    private var uiTimer: Timer?
    private var liveUI = false
    private var housekeeping: DispatchSourceTimer?

    private let storage = WatchStorage.shared
    private let batteryLog = WatchBatteryLog.shared
    private var interruptionObserver: NSObjectProtocol?

    /// Debug builds can shorten the tick and the piece length from launch arguments
    /// (`-voxbriefHousekeepingSeconds 10 -voxbriefSegmentSeconds 20`) to watch pieces roll over.
    private static var housekeepingInterval: TimeInterval {
        #if DEBUG
        let override = UserDefaults.standard.double(forKey: "voxbriefHousekeepingSeconds")
        if override > 0 { return override }
        #endif
        return 5 * 60
    }

    private var segmentLength: TimeInterval {
        #if DEBUG
        let override = UserDefaults.standard.double(forKey: "voxbriefSegmentSeconds")
        if override > 0 { return override }
        #endif
        return config.segmentLength
    }
    private static let lowBatteryPercent = 5
    private static let pausedNotificationId = "voxbrief.recording.paused"

    public override init() {
        super.init()
        setupAudioSessionObservers()
    }

    private func setupAudioSessionObservers() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let typeValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
            Task { @MainActor in
                guard let self else { return }
                switch type {
                case .began: self.handleInterruptionBegan()
                case .ended: self.resumeAfterInterruption()
                @unknown default: break
                }
            }
        }
    }

    deinit {
        if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
    }

    public func requestPermission() async -> Bool {
        if #available(watchOS 10.0, *) {
            return await AVAudioApplication.requestRecordPermission()
        } else {
            return await withCheckedContinuation { continuation in
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    // MARK: - Start / stop

    public func startRecording(source: NoteSource = .watchApp) throws -> UUID {
        if isRecording, let sessionId { return sessionId }

        let config = WatchRecordingConfig.load()
        let session = AVAudioSession.sharedInstance()
        // Record only: nothing here plays sound, so the speaker route stays off.
        try session.setCategory(.record, mode: .default, options: [])
        try session.setActive(true)

        let id = UUID()
        self.sessionId = id
        self.source = source
        self.config = config
        self.elapsedBeforeSegment = 0

        do {
            let (recorder, first) = try beginSegment(index: 0)
            self.audioRecorder = recorder
            self.segment = first
        } catch {
            self.sessionId = nil
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            throw error
        }

        self.isRecording = true
        self.isPaused = false
        self.isInterrupted = false
        self.recordingDuration = 0
        self.sessionStartedAt = Date()

        batteryLog.begin(config: config)
        startHousekeeping()
        applyLiveUI()
        requestNotificationPermission()
        return id
    }

    /// Stops the recording and queues its last piece. The returned note stands for the whole
    /// recording (its total length); the pieces themselves are already in `WatchStorage`.
    public func stopRecording(source: NoteSource = .watchApp) -> WatchLocalNote? {
        endSession(reason: "stopped")
    }

    @discardableResult
    private func endSession(reason: String) -> WatchLocalNote? {
        guard isRecording, let sessionId else { return nil }
        let startedAt = sessionStartedAt ?? Date()

        if let recorder = audioRecorder, let segment {
            elapsedBeforeSegment += finishSegment(recorder, segment)
            batteryLog.sample(event: "piece")
        }
        let total = elapsedBeforeSegment

        stopHousekeeping()
        uiTimer?.invalidate()
        uiTimer = nil
        cancelPausedNotification()

        self.audioRecorder = nil
        self.segment = nil
        self.sessionId = nil
        self.isRecording = false
        self.isPaused = false
        self.isInterrupted = false
        self.audioLevel = 0
        self.recordingDuration = total
        self.sessionStartedAt = nil

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        batteryLog.end(reason: reason)

        // The recording is over, so its pieces can go to the iPhone now.
        WatchSyncService.shared.syncPendingNotes()

        return WatchLocalNote(
            id: sessionId,
            createdAt: startedAt,
            duration: total,
            localFileName: "",
            source: self.source,
            syncState: .pending,
            sessionId: sessionId
        )
    }

    /// Drops the piece being written and ends the recording. Pieces already closed are kept.
    public func cancelRecording() {
        guard isRecording else { return }
        if let recorder = audioRecorder, let segment {
            recorder.stop()
            storage.delete(id: segment.noteId)
        }
        audioRecorder = nil
        segment = nil
        endSession(reason: "cancelled")
    }

    // MARK: - Pause / resume

    public func pauseRecording() {
        guard isRecording, !isPaused, !isInterrupted, let recorder = audioRecorder else { return }
        recorder.pause()
        self.isPaused = true
        self.audioLevel = 0
    }

    public func resumeRecording() {
        guard isRecording, isPaused, let recorder = audioRecorder else { return }
        recorder.record()
        self.isPaused = false
    }

    // MARK: - Pieces

    private func beginSegment(index: Int) throws -> (AVAudioRecorder, Segment) {
        guard let sessionId else {
            throw NSError(domain: "WatchAudioRecorder", code: 2, userInfo: [NSLocalizedDescriptionKey: "No recording in progress."])
        }
        let noteId = UUID()
        let url = storage.newRecordingURL(for: noteId)

        var recorder = try AVAudioRecorder(url: url, settings: config.quality.recorderSettings)
        recorder.delegate = self
        recorder.isMeteringEnabled = liveUI
        if !recorder.record() {
            // An encoder that refuses this bit rate still records at its own default.
            var settings = config.quality.recorderSettings
            settings.removeValue(forKey: AVEncoderBitRateKey)
            settings.removeValue(forKey: AVEncoderAudioQualityKey)
            try? FileManager.default.removeItem(at: url)
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.delegate = self
            recorder.isMeteringEnabled = liveUI
            guard recorder.record() else {
                try? FileManager.default.removeItem(at: url)
                throw NSError(domain: "WatchAudioRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to record on watchOS."])
            }
        }

        storage.addNote(WatchLocalNote(
            id: noteId,
            createdAt: Date(),
            duration: 0,
            localFileName: url.lastPathComponent,
            source: source,
            syncState: .recording,
            sessionId: sessionId,
            segmentIndex: index
        ))
        return (recorder, Segment(noteId: noteId, url: url, index: index))
    }

    /// Closes a piece and queues it. Returns its length.
    private func finishSegment(_ recorder: AVAudioRecorder, _ segment: Segment) -> TimeInterval {
        let duration = recorder.currentTime
        recorder.stop()
        if duration < 0.5 {
            storage.delete(id: segment.noteId)
            return 0
        }
        storage.finishRecording(id: segment.noteId, duration: duration)
        return duration
    }

    /// Starts the next piece, then closes the current one, so the two overlap by a moment instead
    /// of leaving a gap. If the next piece will not start, the current one simply keeps going.
    private func rollOver() {
        guard isRecording, !isPaused, !isInterrupted, let old = audioRecorder, let oldSegment = segment else { return }
        guard let (next, nextSegment) = try? beginSegment(index: oldSegment.index + 1) else { return }
        audioRecorder = next
        segment = nextSegment
        elapsedBeforeSegment += finishSegment(old, oldSegment)
        batteryLog.sample(event: "piece")
        if config.transferPolicy == .rightAway {
            WatchSyncService.shared.syncPendingNotes()
        }
    }

    // MARK: - Housekeeping (the only scheduled work while the screen is off)

    private func startHousekeeping() {
        stopHousekeeping()
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(
            deadline: .now() + Self.housekeepingInterval,
            repeating: Self.housekeepingInterval,
            leeway: .seconds(Int(min(30, Self.housekeepingInterval / 10)))
        )
        timer.setEventHandler { [weak self] in
            Task { @MainActor in self?.housekeepingTick() }
        }
        timer.resume()
        housekeeping = timer
    }

    private func stopHousekeeping() {
        housekeeping?.cancel()
        housekeeping = nil
    }

    private func housekeepingTick() {
        guard isRecording else { return }
        let reading = batteryLog.sample(event: "tick")

        if let percent = reading.percent, percent <= Self.lowBatteryPercent, !reading.charging {
            // Close the file while there is still power to do it: an .m4a cut off mid-write is lost.
            endSession(reason: "low battery")
            WKInterfaceDevice.current().play(.failure)
            notify(title: "Recording saved", body: "Battery is low, so Voxbrief stopped recording and kept everything so far.", after: 1)
            return
        }
        guard !isPaused, !isInterrupted, let recorder = audioRecorder else { return }
        if !recorder.isRecording {
            // The recorder stopped without telling us (the microphone was taken, storage ran out).
            handleInterruptionBegan()
        } else if recorder.currentTime >= segmentLength {
            rollOver()
        }
    }

    // MARK: - Interruptions

    private func handleInterruptionBegan() {
        guard isRecording, !isInterrupted else { return }
        if let recorder = audioRecorder, let segment {
            elapsedBeforeSegment += finishSegment(recorder, segment)
        }
        audioRecorder = nil
        segment = nil
        isInterrupted = true
        isPaused = false
        audioLevel = 0
        recordingDuration = elapsedBeforeSegment
        batteryLog.sample(event: "interrupted")
        // If the recording has not picked up by then, ask to be opened: a watch app can't take the
        // microphone back while it is in the background.
        notify(
            title: "Recording paused",
            body: "A call or Siri took the microphone. Open Voxbrief to keep recording.",
            after: 45,
            id: Self.pausedNotificationId
        )
    }

    /// Picks the recording up after an interruption. Called when the system hands the microphone
    /// back, when the app comes to the front, and from the Resume button.
    public func resumeAfterInterruption() {
        guard isRecording, isInterrupted else { return }
        do {
            try AVAudioSession.sharedInstance().setActive(true)
            let (recorder, next) = try beginSegment(index: (storage.notes.compactMap { $0.sessionId == sessionId ? $0.segmentIndex : nil }.max() ?? 0) + 1)
            audioRecorder = recorder
            segment = next
            isInterrupted = false
            cancelPausedNotification()
            batteryLog.sample(event: "resumed")
            WKInterfaceDevice.current().play(.start)
            applyLiveUI()
        } catch {
            print("[WatchAudioRecorder] Could not resume yet: \(error)")
        }
    }

    /// The app came to the front: the moment a paused recording can take the microphone back.
    public func appBecameActive() {
        if isInterrupted { resumeAfterInterruption() }
    }

    // MARK: - Live screen

    /// Tells the recorder whether anyone is looking. Off (wrist down, dimmed or in the background)
    /// stops the display timer and metering, which is where the recorder spends most of a day.
    public func setLiveUI(_ live: Bool) {
        guard liveUI != live else { return }
        liveUI = live
        applyLiveUI()
    }

    private func applyLiveUI() {
        uiTimer?.invalidate()
        uiTimer = nil
        audioRecorder?.isMeteringEnabled = liveUI
        refreshDuration()
        guard liveUI, isRecording else {
            audioLevel = 0
            return
        }
        uiTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRecording, !self.isPaused, !self.isInterrupted,
                      let recorder = self.audioRecorder else { return }
                self.refreshDuration()
                recorder.updateMeters()
                let power = recorder.averagePower(forChannel: 0)
                self.audioLevel = max(0.0, min(1.0, (power + 55.0) / 55.0))
            }
        }
    }

    private func refreshDuration() {
        guard isRecording else { return }
        recordingDuration = elapsedBeforeSegment + (audioRecorder?.currentTime ?? 0)
    }

    public func setSimulatedRecording(active: Bool, duration: TimeInterval = 14.0, level: Float = 0.65, isPaused: Bool = false) {
        self.isRecording = active
        self.isPaused = isPaused
        self.recordingDuration = duration
        self.audioLevel = level
        self.sessionStartedAt = active ? Date().addingTimeInterval(-duration) : nil
    }

    // MARK: - Notifications

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private func notify(title: String, body: String, after seconds: TimeInterval, id: String = UUID().uuidString) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, seconds), repeats: false)
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    private func cancelPausedNotification() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.pausedNotificationId])
        center.removeDeliveredNotifications(withIdentifiers: [Self.pausedNotificationId])
    }
}

extension WatchAudioRecorder: AVAudioRecorderDelegate {
    public nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        // Pieces are closed by the recorder's own calls.
    }
}
