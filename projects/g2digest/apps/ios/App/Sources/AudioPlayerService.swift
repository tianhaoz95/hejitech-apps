import ActivityKit
import AVFoundation
import Foundation
import G2DigestKit
import MediaPlayer

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
    @Published public private(set) var queue: [CardInput] = []
    @Published public private(set) var queueIndex: Int = 0
    @Published public var autoAdvance: Bool = true

    public var hasNextTrack: Bool { !queue.isEmpty && queueIndex + 1 < queue.count }
    public var hasPreviousTrack: Bool { !queue.isEmpty && queueIndex > 0 }
    public var onTrackChanged: ((CardInput, AudioTrackMode) -> Void)?

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var signedAudioMap: [String: String] = [:]
    private var editionTitle: String = "G2 Digest"
    private var editionDate: String = ""
    private var liveActivity: Activity<G2DigestAudioAttributes>?

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

        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            guard let self, self.hasNextTrack else { return .noSuchContent }
            self.nextTrack()
            return .success
        }

        commandCenter.previousTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            guard let self, self.hasPreviousTrack else { return .noSuchContent }
            self.previousTrack()
            return .success
        }

        commandCenter.skipForwardCommand.isEnabled = true
        commandCenter.skipForwardCommand.preferredIntervals = [15]
        commandCenter.skipForwardCommand.addTarget { [weak self] event in
            guard let self else { return .commandFailed }
            let interval = (event as? MPSkipIntervalCommandEvent)?.interval ?? 15
            self.seek(to: self.currentTime + interval)
            return .success
        }

        commandCenter.skipBackwardCommand.isEnabled = true
        commandCenter.skipBackwardCommand.preferredIntervals = [15]
        commandCenter.skipBackwardCommand.addTarget { [weak self] event in
            guard let self else { return .commandFailed }
            let interval = (event as? MPSkipIntervalCommandEvent)?.interval ?? 15
            self.seek(to: max(0, self.currentTime - interval))
            return .success
        }
    }

    public func updateSignedAudioMap(_ map: [String: String]) {
        self.signedAudioMap = map
    }

    public func playQueue(cards: [CardInput], mode: AudioTrackMode, editionTitle: String = "G2 Digest", editionDate: String = "", startIndex: Int = 0) {
        let playable = cards.filter { resolveAudioURL(card: $0, mode: mode) != nil }
        guard !playable.isEmpty else { return }
        self.editionTitle = editionTitle
        self.editionDate = editionDate
        self.queue = playable
        self.queueIndex = max(0, min(startIndex, playable.count - 1))
        play(card: playable[queueIndex], mode: mode, keepQueue: true)
    }

    public func play(card: CardInput, mode: AudioTrackMode, keepQueue: Bool = false) {
        guard let url = resolveAudioURL(card: card, mode: mode) else { return }

        if currentCard?.slug == card.slug && currentMode == mode && player != nil {
            if isPlaying { pause() } else { resume() }
            return
        }

        if !keepQueue {
            self.queue = [card]
            self.queueIndex = 0
        }

        stopPlayerOnly()

        self.currentCard = card
        self.currentMode = mode
        let playerItem = AVPlayerItem(url: url)
        let newPlayer = AVPlayer(playerItem: playerItem)
        newPlayer.rate = playbackRate
        self.player = newPlayer

        let expectedDuration = (mode == .glance ? card.glance?.durationSec : card.deepDive?.durationSec) ?? 0
        self.duration = expectedDuration
        self.currentTime = 0

        let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserver = newPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self else { return }
            self.currentTime = time.seconds
            self.updateNowPlayingInfo()
            self.updateLiveActivity()
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
        onTrackChanged?(card, mode)
        updateNowPlayingInfo()
        startOrUpdateLiveActivity()
    }

    public func nextTrack() {
        guard hasNextTrack else { return }
        queueIndex += 1
        play(card: queue[queueIndex], mode: currentMode, keepQueue: true)
    }

    public func previousTrack() {
        guard hasPreviousTrack else { return }
        queueIndex -= 1
        play(card: queue[queueIndex], mode: currentMode, keepQueue: true)
    }

    @objc private func playerDidFinishPlaying() {
        if autoAdvance && hasNextTrack {
            nextTrack()
            return
        }
        self.isPlaying = false
        self.currentTime = 0
        updateNowPlayingInfo()
        updateLiveActivity()
    }

    public func pause() {
        player?.pause()
        isPlaying = false
        updateNowPlayingInfo()
        updateLiveActivity()
    }

    public func resume() {
        guard let p = player else { return }
        p.play()
        p.rate = playbackRate
        isPlaying = true
        updateNowPlayingInfo()
        updateLiveActivity()
    }

    public func togglePlayPause() {
        if isPlaying { pause() } else { resume() }
    }

    private func stopPlayerOnly() {
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
        }
        NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: nil)
        player?.pause()
        player = nil
    }

    public func stop() {
        stopPlayerOnly()
        isPlaying = false
        currentCard = nil
        currentTime = 0
        duration = 0
        queue = []
        queueIndex = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        endLiveActivity()
    }

    public func seek(to seconds: Double) {
        guard let p = player else { return }
        let clamped = max(0, min(seconds, duration))
        let targetTime = CMTime(seconds: clamped, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        p.seek(to: targetTime) { [weak self] _ in
            self?.currentTime = clamped
            self?.updateNowPlayingInfo()
            self?.updateLiveActivity()
        }
    }

    public func setPlaybackRate(_ rate: Float) {
        self.playbackRate = rate
        if isPlaying { player?.rate = rate }
        updateNowPlayingInfo()
    }

    public func cyclePlaybackRate() {
        let rates: [Float] = [1.0, 1.25, 1.5, 2.0]
        if let idx = rates.firstIndex(of: playbackRate) {
            setPlaybackRate(rates[(idx + 1) % rates.count])
        } else {
            setPlaybackRate(1.0)
        }
    }

    private func resolveAudioURL(card: CardInput, mode: AudioTrackMode) -> URL? {
        guard let audioPath = (mode == .glance ? card.glance?.audioPath : card.deepDive?.audioPath) else {
            return nil
        }
        if let local = OfflineStore.shared.localAudioURL(for: audioPath) {
            return local
        }
        if let signed = signedAudioMap[audioPath] {
            return URL(string: signed)
        }
        return nil
    }

    private func updateNowPlayingInfo() {
        guard let card = currentCard else { return }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: card.title,
            MPMediaItemPropertyArtist: "G2 Digest · \(currentMode.displayTitle)",
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? playbackRate : 0.0,
        ]
        if !queue.isEmpty {
            info[MPNowPlayingInfoPropertyPlaybackQueueIndex] = queueIndex
            info[MPNowPlayingInfoPropertyPlaybackQueueCount] = queue.count
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func currentActivityState() -> G2DigestAudioAttributes.ContentState? {
        guard let card = currentCard else { return nil }
        let progress = duration > 0 ? max(0, min(1, currentTime / duration)) : 0
        let pos = queue.count > 1 ? "\(queueIndex + 1)/\(queue.count)" : currentMode.displayTitle
        return G2DigestAudioAttributes.ContentState(
            cardTitle: card.title,
            modeLabel: currentMode.displayTitle,
            isPlaying: isPlaying,
            progress: progress,
            cardPosition: pos
        )
    }

    private func startOrUpdateLiveActivity() {
        guard ActivityAuthorizationInfo().areActivitiesEnabled, let state = currentActivityState() else { return }
        if let existing = liveActivity {
            Task { await existing.update(ActivityContent(state: state, staleDate: nil)) }
        } else {
            let attrs = G2DigestAudioAttributes(editionTitle: editionTitle, editionDate: editionDate)
            liveActivity = try? Activity<G2DigestAudioAttributes>.request(
                attributes: attrs,
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
        }
    }

    private func updateLiveActivity() {
        guard let existing = liveActivity, let state = currentActivityState() else { return }
        Task { await existing.update(ActivityContent(state: state, staleDate: nil)) }
    }

    private func endLiveActivity() {
        guard let existing = liveActivity else { return }
        liveActivity = nil
        Task { await existing.end(nil, dismissalPolicy: .immediate) }
    }
}
