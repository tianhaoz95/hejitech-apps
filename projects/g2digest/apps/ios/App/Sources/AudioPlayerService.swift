import Foundation
import AVFoundation
import MediaPlayer
import G2DigestKit

public enum AudioTrackMode: String, Sendable {
    case glance
    case deepDive = "deep_dive"

    public var displayTitle: String {
        switch self {
        case .glance: return "Glance"
        case .deepDive: return "Deep Dive"
        }
    }
}

@MainActor
public final class AudioPlayerService: NSObject, ObservableObject {
    public static let shared = AudioPlayerService()

    @Published public private(set) var isPlaying: Bool = false
    @Published public private(set) var currentCard: CardInput?
    @Published public private(set) var currentMode: AudioTrackMode = .glance
    @Published public private(set) var currentTime: Double = 0
    @Published public private(set) var duration: Double = 0
    @Published public private(set) var playbackRate: Float = 1.0

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var signedAudioMap: [String: SignedAudioEntry] = [:]

    public override init() {
        super.init()
        setupAudioSession()
        setupRemoteCommandCenter()
    }

    private func setupAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [.allowAirPlay, .duckOthers])
            try session.setActive(true)
        } catch {
            print("Failed to configure AVAudioSession: \(error)")
        }
    }

    private func setupRemoteCommandCenter() {
        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.isEnabled = true
        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.resume()
            return .success
        }

        commandCenter.pauseCommand.isEnabled = true
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.pause()
            return .success
        }

        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.togglePlayPause()
            return .success
        }

        commandCenter.skipForwardCommand.isEnabled = true
        commandCenter.skipForwardCommand.preferredIntervals = [15]
        commandCenter.skipForwardCommand.addTarget { [weak self] event in
            guard let self = self else { return .commandFailed }
            let interval = (event as? MPSkipIntervalCommandEvent)?.interval ?? 15
            self.seek(to: self.currentTime + interval)
            return .success
        }

        commandCenter.skipBackwardCommand.isEnabled = true
        commandCenter.skipBackwardCommand.preferredIntervals = [15]
        commandCenter.skipBackwardCommand.addTarget { [weak self] event in
            guard let self = self else { return .commandFailed }
            let interval = (event as? MPSkipIntervalCommandEvent)?.interval ?? 15
            self.seek(to: max(0, self.currentTime - interval))
            return .success
        }
    }

    public func updateSignedAudioMap(_ map: [String: SignedAudioEntry]) {
        self.signedAudioMap = map
    }

    public func play(card: CardInput, mode: AudioTrackMode) {
        guard let urlString = resolveAudioURL(card: card, mode: mode),
              let url = URL(string: urlString) else {
            return
        }

        if currentCard?.slug == card.slug && currentMode == mode && player != nil {
            if isPlaying {
                pause()
            } else {
                resume()
            }
            return
        }

        stop()

        self.currentCard = card
        self.currentMode = mode
        let playerItem = AVPlayerItem(url: url)
        let newPlayer = AVPlayer(playerItem: playerItem)
        newPlayer.rate = playbackRate
        self.player = newPlayer

        let expectedDuration = (mode == .glance ? card.glance?.durationSec : card.deepDive?.durationSec) ?? 0
        self.duration = expectedDuration
        self.currentTime = 0

        let interval = CMTime(seconds: 0.25, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserver = newPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self = self else { return }
            self.currentTime = time.seconds
            self.updateNowPlayingInfo()
        }

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerDidFinishPlaying),
            name: .AVPlayerItemDidPlayToEndTime,
            object: playerItem
        )

        newPlayer.play()
        newPlayer.rate = playbackRate
        self.isPlaying = true
        updateNowPlayingInfo()
    }

    @objc private func playerDidFinishPlaying() {
        self.isPlaying = false
        self.currentTime = 0
        updateNowPlayingInfo()
    }

    public func pause() {
        player?.pause()
        isPlaying = false
        updateNowPlayingInfo()
    }

    public func resume() {
        guard let p = player else { return }
        p.play()
        p.rate = playbackRate
        isPlaying = true
        updateNowPlayingInfo()
    }

    public func togglePlayPause() {
        if isPlaying {
            pause()
        } else {
            resume()
        }
    }

    public func stop() {
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
        }
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: nil)
        player?.pause()
        player = nil
        isPlaying = false
        currentCard = nil
        currentTime = 0
        duration = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    public func seek(to seconds: Double) {
        guard let p = player else { return }
        let clamped = max(0, min(seconds, duration))
        let targetTime = CMTime(seconds: clamped, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        p.seek(to: targetTime) { [weak self] _ in
            self?.currentTime = clamped
            self?.updateNowPlayingInfo()
        }
    }

    public func setPlaybackRate(_ rate: Float) {
        self.playbackRate = rate
        if isPlaying {
            player?.rate = rate
        }
        updateNowPlayingInfo()
    }

    public func cyclePlaybackRate() {
        let rates: [Float] = [1.0, 1.25, 1.5, 2.0]
        if let idx = rates.firstIndex(of: playbackRate) {
            let nextIdx = (idx + 1) % rates.count
            setPlaybackRate(rates[nextIdx])
        } else {
            setPlaybackRate(1.0)
        }
    }

    private func resolveAudioURL(card: CardInput, mode: AudioTrackMode) -> String? {
        if let entry = signedAudioMap[card.slug] {
            return mode == .glance ? entry.glance : entry.deepDive
        }
        return nil
    }

    private func updateNowPlayingInfo() {
        guard let card = currentCard else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: "\(card.title) (\(currentMode.displayTitle))",
            MPMediaItemPropertyArtist: "G2 Digest",
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? Double(playbackRate) : 0.0
        ]

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
}
