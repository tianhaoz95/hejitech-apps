import AVFoundation
import Foundation
import RoarlyKit

/// One `AVAudioEngine` for the microphone and the sounds, so the iPhone's echo cancellation
/// (voice processing) knows what it is playing and the listener doesn't hear its own roar.
///
/// One-shots play on a small pool of player nodes; each ambient bed loops on its own node and
/// fades in and out. Sounds are bundled as `Sounds/<file>.m4a` (mono, 44.1 kHz).
@MainActor
final class AudioHub {
    static let shared = AudioHub()

    private(set) var engine = AVAudioEngine()
    private(set) var isRunning = false
    private(set) var isListening = false

    /// Microphone buffers while listening (called on the audio thread).
    var onInput: (@Sendable (AVAudioPCMBuffer, AVAudioTime) -> Void)?
    /// 0…1 microphone level for the UI.
    private(set) var inputLevel: Float = 0

    private var pool: [AVAudioPlayerNode] = []
    private var nextInPool = 0
    private var ambients: [String: AVAudioPlayerNode] = [:]
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    private var fades: [ObjectIdentifier: Task<Void, Never>] = [:]
    private var previewPlayer: AVAudioPlayer?
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)!
    private var observers: [NSObjectProtocol] = []

    private init() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let type = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt).flatMap(AVAudioSession.InterruptionType.init)
            Task { @MainActor in self?.handleInterruption(type) }
        })
        observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.handleConfigurationChange() }
        })
    }

    /// Called when listening resumes after a phone call or Siri.
    var onRestartNeeded: (() -> Void)?

    // MARK: - Engine

    /// Starts the engine for a story: microphone (with echo cancellation) plus playback.
    func startListening() throws {
        stopEngine()
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers])
        try session.setPreferredIOBufferDuration(0.02)
        try session.setActive(true)

        let engine = AVAudioEngine()
        self.engine = engine
        let input = engine.inputNode
        do {
            try input.setVoiceProcessingEnabled(true)
            // Our own sounds are the echo reference; don't also turn other audio down.
            input.voiceProcessingOtherAudioDuckingConfiguration = .init(enableAdvancedDucking: false, duckingLevel: .min)
        } catch {
            log("voice processing unavailable, listening without echo cancellation: \(error)")
        }
        attachPlayers(to: engine)

        let inFormat = input.outputFormat(forBus: 0)
        guard inFormat.sampleRate > 0, inFormat.channelCount > 0 else {
            throw NSError(domain: "Roarly", code: 1, userInfo: [NSLocalizedDescriptionKey: "No microphone is available."])
        }
        let tap = Self.makeTap(forward: onInput) { [weak self] level in
            Task { @MainActor in
                guard let self else { return }
                self.inputLevel = self.inputLevel * 0.6 + level * 0.4
            }
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: inFormat, block: tap)
        engine.prepare()
        try engine.start()
        isRunning = true
        isListening = true
        log("engine started (input \(Int(inFormat.sampleRate)) Hz × \(inFormat.channelCount))")
    }

    /// Playback only (the demo story): no microphone.
    func startPlayback() throws {
        stopEngine()
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)
        let engine = AVAudioEngine()
        self.engine = engine
        attachPlayers(to: engine)
        engine.prepare()
        try engine.start()
        isRunning = true
    }

    func stopListening() {
        stopEngine()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func stopEngine() {
        pendingResume?.cancel()
        pendingResume = nil
        for task in fades.values { task.cancel() }
        fades = [:]
        if isRunning {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        for node in pool + Array(ambients.values) { engine.detach(node) }
        pool = []
        ambients = [:]
        isRunning = false
        isListening = false
        inputLevel = 0
    }

    /// Built outside the main actor: the block runs on the audio thread.
    nonisolated private static func makeTap(
        forward: (@Sendable (AVAudioPCMBuffer, AVAudioTime) -> Void)?,
        level: @escaping @Sendable (Float) -> Void
    ) -> AVAudioNodeTapBlock {
        var counter = 0
        return { buffer, time in
            forward?(buffer, time)
            counter += 1
            if counter == 50 { log("microphone audio is flowing (\(Int(buffer.format.sampleRate)) Hz)") }
            guard counter % 4 == 0, let ch = buffer.floatChannelData?[0] else { return }
            var sum: Float = 0
            let n = Int(buffer.frameLength)
            for i in stride(from: 0, to: n, by: 4) { sum += ch[i] * ch[i] }
            level(min(1, sqrt(sum / Float(max(1, n / 4))) * 12))
        }
    }

    private func attachPlayers(to engine: AVAudioEngine) {
        pool = (0..<5).map { _ in
            let node = AVAudioPlayerNode()
            engine.attach(node)
            engine.connect(node, to: engine.mainMixerNode, format: format)
            return node
        }
    }

    private func handleInterruption(_ type: AVAudioSession.InterruptionType?) {
        guard isListening else { return }
        if type == .ended {
            log("interruption ended, restarting")
            onRestartNeeded?()
        }
    }

    /// iOS reports a configuration change when the route or format changes, and also right after
    /// voice processing switches on. Tearing everything down (as this used to) switched voice
    /// processing on again, which reported another change: the story flipped between "Getting
    /// ready" and "Listening" forever. Now: settle briefly, then restart the same engine in place
    /// with the tap on the new format; only if that fails ask for a full restart.
    private func handleConfigurationChange() {
        guard isListening else { return }
        pendingResume?.cancel()
        pendingResume = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(300))
            guard let self, !Task.isCancelled, self.isListening, !self.engine.isRunning else { return }
            do {
                try self.resumeInPlace()
                log("audio configuration changed; engine resumed in place")
            } catch {
                log("audio configuration changed; resume failed (\(error)), restarting")
                self.onRestartNeeded?()
            }
        }
    }

    private var pendingResume: Task<Void, Never>?

    private func resumeInPlace() throws {
        let input = engine.inputNode
        input.removeTap(onBus: 0)
        let inFormat = input.outputFormat(forBus: 0)
        guard inFormat.sampleRate > 0, inFormat.channelCount > 0 else {
            throw NSError(domain: "Roarly", code: 1, userInfo: [NSLocalizedDescriptionKey: "No microphone is available."])
        }
        let tap = Self.makeTap(forward: onInput) { [weak self] level in
            Task { @MainActor in
                guard let self else { return }
                self.inputLevel = self.inputLevel * 0.6 + level * 0.4
            }
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: inFormat, block: tap)
        engine.prepare()
        try engine.start()
    }

    // MARK: - Sounds

    static func url(for file: String) -> URL? {
        Bundle.main.url(forResource: file, withExtension: "m4a", subdirectory: "Sounds")
    }

    private func buffer(for file: String) -> AVAudioPCMBuffer? {
        if let b = buffers[file] { return b }
        guard let url = Self.url(for: file), let f = try? AVAudioFile(forReading: url) else {
            log("missing sound \(file)")
            return nil
        }
        let src = f.processingFormat
        guard let raw = AVAudioPCMBuffer(pcmFormat: src, frameCapacity: AVAudioFrameCount(f.length)) else { return nil }
        do { try f.read(into: raw) } catch { return nil }
        var result = raw
        if src.sampleRate != format.sampleRate || src.channelCount != format.channelCount,
           let converter = AVAudioConverter(from: src, to: format),
           let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(Double(raw.frameLength) * format.sampleRate / src.sampleRate) + 1024) {
            var given = false
            var error: NSError?
            converter.convert(to: out, error: &error) { _, status in
                if given { status.pointee = .endOfStream; return nil }
                given = true
                status.pointee = .haveData
                return raw
            }
            if error == nil { result = out }
        }
        buffers[file] = result
        return result
    }

    func preload(_ cue: Cue) {
        for f in cue.files { _ = buffer(for: f) }
    }

    func play(_ cue: Cue, volume: Double) {
        guard isRunning, let file = cue.files.randomElement(), let buffer = buffer(for: file), !pool.isEmpty else {
            preview(cue, volume: volume)
            return
        }
        let node = pool[nextInPool % pool.count]
        nextInPool += 1
        node.stop()
        node.volume = Float(volume)
        node.scheduleBuffer(buffer, at: nil, options: [.interrupts])
        node.play()
    }

    func startAmbient(_ cue: Cue, volume: Double) {
        guard isRunning, ambients[cue.id] == nil, let file = cue.files.first, let buffer = buffer(for: file) else { return }
        let node = AVAudioPlayerNode()
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
        node.volume = 0
        node.scheduleBuffer(buffer, at: nil, options: [.loops])
        node.play()
        ambients[cue.id] = node
        fade(node, to: Float(volume), over: 2.5)
    }

    func stopAmbient(_ id: String, over seconds: Double = 2.5) {
        guard let node = ambients.removeValue(forKey: id) else { return }
        fade(node, to: 0, over: seconds) { [weak self] in
            node.stop()
            self?.engine.detach(node)
        }
    }

    /// Fades every sound out (the end of the story).
    func fadeAll(over seconds: Double = 5) {
        for id in Array(ambients.keys) { stopAmbient(id, over: seconds) }
        for node in pool { fade(node, to: 0, over: min(seconds, 1.5)) { node.stop() } }
    }

    func stopAll() {
        for id in Array(ambients.keys) { stopAmbient(id, over: 0.4) }
        for node in pool { node.stop() }
        previewPlayer?.stop()
    }

    private func fade(_ node: AVAudioPlayerNode, to target: Float, over seconds: Double, then done: (() -> Void)? = nil) {
        let key = ObjectIdentifier(node)
        fades[key]?.cancel()
        let start = node.volume
        fades[key] = Task { @MainActor [weak self] in
            let steps = max(1, Int(seconds * 30))
            for i in 1...steps {
                try? await Task.sleep(for: .milliseconds(33))
                if Task.isCancelled { return }
                let t = Float(i) / Float(steps)
                node.volume = start + (target - start) * t * t * (3 - 2 * t)
            }
            self?.fades[key] = nil
            done?()
        }
    }

    /// Plays a sound outside a story (the library), through a plain player.
    func preview(_ cue: Cue, volume: Double = 0.9) {
        if isRunning, let buffer = cue.files.first.flatMap(buffer(for:)), let node = pool.first {
            node.stop()
            node.volume = Float(volume)
            node.scheduleBuffer(buffer, at: nil, options: [.interrupts])
            node.play()
            return
        }
        guard let url = cue.files.randomElement().flatMap(Self.url(for:)) else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        previewPlayer = try? AVAudioPlayer(contentsOf: url)
        previewPlayer?.volume = Float(volume)
        if cue.kind == .ambient { previewPlayer?.currentTime = 0 }
        previewPlayer?.play()
        if cue.kind == .ambient {
            let player = previewPlayer
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(5))
                player?.setVolume(0, fadeDuration: 1.5)
                try? await Task.sleep(for: .seconds(1.6))
                player?.stop()
            }
        }
    }

    var activeAmbientIDs: Set<String> { Set(ambients.keys) }
}

func log(_ message: String) {
    let t = Date().formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute().second().secondFraction(.fractional(2)))
    // stderr: unbuffered, and what `devicectl … --console` reliably shows.
    fputs("[Roarly \(t)] \(message)\n", stderr)
}
