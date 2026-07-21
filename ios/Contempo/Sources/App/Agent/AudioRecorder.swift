import AVFoundation
import Observation

/// Raw 16kHz mono Float32 capture for `WhisperTranscriber`, via
/// `AVAudioEngine`'s input tap. Record-then-transcribe, not streaming — this
/// just accumulates samples in memory until `stop()` is called, matching
/// `WhisperTranscriber`'s non-streaming Whisper model.
///
/// `amplitude` is exposed live purely for Capture's listening animation — a
/// crude per-buffer peak level, not used for silence detection or auto-stop.
/// Start/stop is always the user's explicit action here.
@Observable
@MainActor
final class AudioRecorder {
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
            throw AudioRecorderError.formatUnavailable
        }
        guard let converter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
            throw AudioRecorderError.formatUnavailable
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
            
            let now = CACurrentMediaTime()
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

    /// Stops recording and returns everything captured since `start()`.
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

enum AudioRecorderError: Error {
    case formatUnavailable
}
