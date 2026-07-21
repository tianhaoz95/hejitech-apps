import AVFoundation
import Observation

/// watchOS counterpart to the phone's `AudioRecorder` — same 16kHz mono
/// `AVAudioEngine` tap approach (supported on watchOS for foreground
/// microphone capture). Record-then-encode, not streaming: samples
/// accumulate in memory until `stop()`, then `WavAudio.encode` turns them
/// into a durable `.wav` file.
@Observable
@MainActor
final class WatchAudioRecorder {
    static let sampleRateHz: Double = 16_000

    private let engine = AVAudioEngine()
    private var samples: [Float] = []

    private(set) var amplitude: Float = 0
    private(set) var isRecording = false

    func hasPermission() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return true
        case .denied: return false
        case .undetermined:
            return await AVAudioApplication.requestRecordPermission()
        @unknown default:
            return false
        }
    }

    func start() throws {
        samples.removeAll()

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement)
        try session.setActive(true)

        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)
        guard let targetFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Self.sampleRateHz, channels: 1, interleaved: false) else {
            throw WatchAudioRecorderError.formatUnavailable
        }
        guard let converter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
            throw WatchAudioRecorderError.formatUnavailable
        }

        var lastAmplitudeUpdate: Double = 0
        input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
            guard let self else { return }
            guard let converted = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: buffer.frameLength) else { return }
            var error: NSError?
            converter.convert(to: converted, error: &error) { _, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }
            guard error == nil, let channelData = converted.floatChannelData else { return }
            let frameCount = Int(converted.frameLength)
            let floats = Array(UnsafeBufferPointer(start: channelData[0], count: frameCount))
            let peak = floats.reduce(Float(0)) { max($0, abs($1)) }

            let now = ProcessInfo.processInfo.systemUptime
            let shouldUpdateAmplitude = (now - lastAmplitudeUpdate) >= 0.04
            if shouldUpdateAmplitude {
                lastAmplitudeUpdate = now
            }

            Task { @MainActor [weak self] in
                guard let self else { return }
                self.samples.append(contentsOf: floats)
                if shouldUpdateAmplitude {
                    self.amplitude = peak
                }
            }
        }

        engine.prepare()
        try engine.start()
        isRecording = true
    }

    func stop() -> [Float] {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        isRecording = false
        amplitude = 0
        defer { samples.removeAll() }
        return samples
    }
}

enum WatchAudioRecorderError: Error {
    case formatUnavailable
}
