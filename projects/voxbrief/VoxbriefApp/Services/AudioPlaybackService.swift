import Foundation
import AVFoundation
import Combine

@MainActor
public final class AudioPlaybackService: NSObject, ObservableObject {
    public static let shared = AudioPlaybackService()
    
    @Published public private(set) var isPlaying: Bool = false
    @Published public private(set) var currentTime: TimeInterval = 0
    @Published public private(set) var duration: TimeInterval = 0
    @Published public private(set) var currentlyPlayingFileName: String?
    @Published public var playbackRate: Float = 1.0
    @Published public var isLooping: Bool = false
    
    private var audioPlayer: AVAudioPlayer?
    private var timer: Timer?
    private let audioFileManager: AudioFileManager
    
    public init(audioFileManager: AudioFileManager = .shared) {
        self.audioFileManager = audioFileManager
        super.init()
    }

    public func setRate(_ rate: Float) {
        playbackRate = rate
        if let player = audioPlayer {
            player.enableRate = true
            player.rate = rate
        }
    }

    @discardableResult
    public func cyclePlaybackRate() -> Float {
        let rates: [Float] = [1.0, 1.25, 1.5, 2.0, 0.8]
        if let idx = rates.firstIndex(where: { abs($0 - playbackRate) < 0.05 }) {
            let next = rates[(idx + 1) % rates.count]
            setRate(next)
            return next
        } else {
            setRate(1.0)
            return 1.0
        }
    }
    
    public func play(fileName: String) {
        if currentlyPlayingFileName == fileName && audioPlayer != nil {
            if isPlaying {
                pause()
            } else {
                resume()
            }
            return
        }
        
        stop()
        
        let fileURL = audioFileManager.url(for: fileName)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            print("[AudioPlaybackService] Audio file not found at \(fileURL.path)")
            return
        }
        
        do {
            #if os(iOS)
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
            try AVAudioSession.sharedInstance().setActive(true)
            #endif

            let player = try AVAudioPlayer(contentsOf: fileURL)
            player.delegate = self
            player.enableRate = true
            player.rate = playbackRate
            player.prepareToPlay()
            player.play()
            
            self.audioPlayer = player
            self.currentlyPlayingFileName = fileName
            self.duration = player.duration
            self.currentTime = 0
            self.isPlaying = true
            
            startProgressTimer()
        } catch {
            print("[AudioPlaybackService] Failed to play audio: \(error)")
        }
    }
    
    public func pause() {
        audioPlayer?.pause()
        isPlaying = false
        timer?.invalidate()
        timer = nil
    }
    
    public func resume() {
        guard let player = audioPlayer else { return }
        player.play()
        isPlaying = true
        startProgressTimer()
    }
    
    public func stop() {
        audioPlayer?.stop()
        audioPlayer = nil
        isPlaying = false
        currentTime = 0
        currentlyPlayingFileName = nil
        timer?.invalidate()
        timer = nil
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
    
    public func toggleLooping() {
        isLooping.toggle()
    }

    public func skipForward(seconds: TimeInterval = 15) {
        guard duration > 0 else { return }
        seek(toTime: min(duration, currentTime + seconds))
    }

    public func skipBackward(seconds: TimeInterval = 15) {
        guard duration > 0 else { return }
        seek(toTime: max(0, currentTime - seconds))
    }

    public func seek(to progress: Double) {
        guard let player = audioPlayer else { return }
        let targetTime = player.duration * max(0.0, min(1.0, progress))
        seek(toTime: targetTime)
    }

    public func seek(toTime targetTime: TimeInterval) {
        guard let player = audioPlayer else { return }
        let clamped = max(0.0, min(player.duration, targetTime))
        player.currentTime = clamped
        self.currentTime = clamped
    }

    public func play(fileName: String, startingAt time: TimeInterval) {
        if currentlyPlayingFileName == fileName {
            seek(toTime: time)
            if !isPlaying {
                resume()
            }
        } else {
            play(fileName: fileName)
            seek(toTime: time)
        }
    }
    
    private func startProgressTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self, let player = self.audioPlayer else { return }
            self.currentTime = player.currentTime
        }
    }
}

extension AudioPlaybackService: AVAudioPlayerDelegate {
    public nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            if self.isLooping {
                self.seek(toTime: 0)
                self.resume()
            } else {
                self.stop()
            }
        }
    }
}
