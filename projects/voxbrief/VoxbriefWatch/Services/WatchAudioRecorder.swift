import Foundation
import AVFoundation
import Combine

@MainActor
public final class WatchAudioRecorder: NSObject, ObservableObject {
    public static let shared = WatchAudioRecorder()
    
    @Published public private(set) var isRecording: Bool = false
    @Published public private(set) var isPaused: Bool = false
    @Published public private(set) var recordingDuration: TimeInterval = 0
    @Published public private(set) var audioLevel: Float = 0.0
    
    private var audioRecorder: AVAudioRecorder?
    private var timer: Timer?
    private var currentNoteId: UUID?
    private var currentFileURL: URL?
    
    private let storage = WatchStorage.shared
    private var interruptionObserver: NSObjectProtocol?
    
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
            guard let self = self,
                  let userInfo = notification.userInfo,
                  let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

            if type == .began && self.isRecording {
                print("[WatchAudioRecorder] Interruption began, stopping active recording")
                _ = self.stopRecording()
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
    
    public func startRecording(source: NoteSource = .watchApp) throws -> UUID {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.duckOthers])
        try session.setActive(true)
        
        let noteId = UUID()
        let fileURL = storage.newRecordingURL(for: noteId)
        self.currentNoteId = noteId
        self.currentFileURL = fileURL
        
        let settings = AudioConstants.voiceRecordingSettings
        let recorder = try AVAudioRecorder(url: fileURL, settings: settings)
        recorder.isMeteringEnabled = true
        recorder.delegate = self
        
        guard recorder.record() else {
            throw NSError(domain: "WatchAudioRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to record on watchOS."])
        }
        
        self.audioRecorder = recorder
        self.isRecording = true
        self.isPaused = false
        self.recordingDuration = 0
        
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self, let recorder = self.audioRecorder, self.isRecording else { return }
            guard !self.isPaused else { return }
            self.recordingDuration = recorder.currentTime
            recorder.updateMeters()
            let power = recorder.averagePower(forChannel: 0)
            let normalized = max(0.0, min(1.0, (power + 55.0) / 55.0))
            self.audioLevel = normalized
        }
        
        return noteId
    }

    public func pauseRecording() {
        guard isRecording, !isPaused, let recorder = audioRecorder else { return }
        recorder.pause()
        self.isPaused = true
        self.audioLevel = 0
    }

    public func resumeRecording() {
        guard isRecording, isPaused, let recorder = audioRecorder else { return }
        recorder.record()
        self.isPaused = false
    }
    
    public func setSimulatedRecording(active: Bool, duration: TimeInterval = 14.0, level: Float = 0.65, isPaused: Bool = false) {
        self.isRecording = active
        self.isPaused = isPaused
        self.recordingDuration = duration
        self.audioLevel = level
    }

    public func stopRecording(source: NoteSource = .watchApp) -> WatchLocalNote? {
        guard isRecording, let recorder = audioRecorder, let noteId = currentNoteId, let fileURL = currentFileURL else {
            return nil
        }
        
        let duration = recorder.currentTime
        recorder.stop()
        timer?.invalidate()
        timer = nil
        
        self.isRecording = false
        self.isPaused = false
        self.audioRecorder = nil
        self.audioLevel = 0
        
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        
        let fileName = fileURL.lastPathComponent
        let note = WatchLocalNote(
            id: noteId,
            createdAt: Date(),
            duration: duration,
            localFileName: fileName,
            source: source,
            syncState: .pending
        )
        
        storage.addNote(note)
        return note
    }
    
    public func cancelRecording() {
        timer?.invalidate()
        timer = nil
        audioRecorder?.stop()
        if let url = currentFileURL {
            try? FileManager.default.removeItem(at: url)
        }
        self.isRecording = false
        self.isPaused = false
        self.audioRecorder = nil
        self.audioLevel = 0
    }
}

extension WatchAudioRecorder: AVAudioRecorderDelegate {
    public nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        // Handled in stopRecording
    }
}
