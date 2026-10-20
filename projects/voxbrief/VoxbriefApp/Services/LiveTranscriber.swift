import AVFoundation
import Foundation

/// Live transcript while recording on iPhone: the words appear under the waveform as they're
/// spoken, and when the live pass has kept up, the note skips Stage 1 entirely after Stop.
///
/// An `AVAudioEngine` input tap runs next to `AudioRecordingService`'s `AVAudioRecorder` (which
/// still writes the m4a the note keeps), converting the microphone to 16 kHz mono for WhisperKit.
/// Every `interval` the unconfirmed window is transcribed again. Once the window is longer than
/// `confirmAfter`, every segment but the last is confirmed (Whisper rarely revises text that far
/// back) and the window moves past them, so each pass stays short however long the recording.
///
/// The Watch is untouched: it only records, by design. If the engine can't start (another app
/// holds the input in an incompatible format, say), recording carries on and the note is
/// transcribed after Stop exactly as before.
@MainActor
final class LiveTranscriber: ObservableObject {
    static let shared = LiveTranscriber()

    static let enabledKey = "live_transcript_enabled"
    static var isEnabled: Bool { (UserDefaults.standard.object(forKey: enabledKey) as? Bool) ?? true }

    static let sampleRate: Double = 16_000
    static let interval: Duration = .milliseconds(1500)
    static let confirmAfter: TimeInterval = 15

    @Published private(set) var isActive = false
    @Published private(set) var confirmedText = ""
    @Published private(set) var tentativeText = ""

    private let asr: ASRService
    private var engine: AVAudioEngine?
    private var buffer = SampleBuffer()
    private var loopTask: Task<Void, Never>?
    private var vocabulary: [String] = []
    private var confirmed: [TranscriptTimingSegment] = []
    private var tentative: [TranscriptTimingSegment] = []
    /// Absolute sample index where the unconfirmed window starts.
    private var windowStart = 0
    private var failed = false

    init(asr: ASRService = .shared) {
        self.asr = asr
    }

    /// Starts listening alongside a recording that has just started (the audio session is
    /// already active for recording).
    func start(vocabulary: [String]) {
        stopEngine()
        reset()
        guard Self.isEnabled else { return }
        self.vocabulary = vocabulary

        let engine = AVAudioEngine()
        let input = engine.inputNode
        let inFormat = input.outputFormat(forBus: 0)
        guard inFormat.sampleRate > 0, inFormat.channelCount > 0,
              let outFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Self.sampleRate, channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: inFormat, to: outFormat) else { return }

        let buffer = self.buffer
        input.installTap(onBus: 0, bufferSize: 4096, format: inFormat) { pcm, _ in
            let capacity = AVAudioFrameCount(Double(pcm.frameLength) * Self.sampleRate / inFormat.sampleRate) + 64
            guard let out = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: capacity) else { return }
            var supplied = false
            var error: NSError?
            converter.convert(to: out, error: &error) { _, status in
                if supplied {
                    status.pointee = .noDataNow
                    return nil
                }
                supplied = true
                status.pointee = .haveData
                return pcm
            }
            if error == nil, let channel = out.floatChannelData?[0], out.frameLength > 0 {
                buffer.append(UnsafeBufferPointer(start: channel, count: Int(out.frameLength)))
            }
        }
        do {
            engine.prepare()
            try engine.start()
        } catch {
            print("[LiveTranscriber] Couldn't start the input tap, transcribing after Stop instead: \(error)")
            input.removeTap(onBus: 0)
            return
        }
        self.engine = engine
        isActive = true
        loopTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: Self.interval)
                guard let self, self.isActive else { return }
                await self.transcribeWindow(final: false)
            }
        }
    }

    /// Stops listening and returns the whole transcript with segment timings, or `nil` when the
    /// live pass didn't run or failed (the pipeline then transcribes the file as usual).
    func finish() async -> (transcript: String, segments: [TranscriptTimingSegment])? {
        guard isActive else { return nil }
        isActive = false
        stopEngine()
        loopTask?.cancel()
        await loopTask?.value
        loopTask = nil
        await transcribeWindow(final: true)
        defer { reset() }
        guard !failed, !confirmed.isEmpty else { return nil }
        let transcript = confirmed.map(\.text).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        return transcript.isEmpty ? nil : (transcript, confirmed)
    }

    /// Stops without a result (the recording was cancelled).
    func cancel() {
        isActive = false
        stopEngine()
        loopTask?.cancel()
        loopTask = nil
        reset()
    }

    private func transcribeWindow(final: Bool) async {
        let (samples, start) = buffer.samples(from: windowStart)
        guard final || samples.count >= Int(Self.sampleRate) else { return }
        let offset = Double(start) / Self.sampleRate
        let segments: [TranscriptTimingSegment]
        do {
            segments = try await asr.transcribeSamples(samples, vocabulary: vocabulary).map {
                TranscriptTimingSegment(start: $0.start + offset, end: $0.end + offset, text: $0.text)
            }
        } catch {
            print("[LiveTranscriber] Live pass failed: \(error)")
            failed = true
            return
        }

        let windowSeconds = Double(samples.count) / Self.sampleRate
        if final {
            confirmed += segments
            tentative = []
        } else if windowSeconds > Self.confirmAfter, segments.count >= 2, let last = segments.last {
            confirmed += segments.dropLast()
            tentative = [last]
            windowStart = Int(last.start * Self.sampleRate)
            buffer.drop(before: windowStart)
        } else {
            tentative = segments
        }
        confirmedText = confirmed.map(\.displayText).joined(separator: " ")
        tentativeText = tentative.map(\.displayText).joined(separator: " ")
    }

    private func stopEngine() {
        guard let engine else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        self.engine = nil
    }

    private func reset() {
        buffer = SampleBuffer()
        confirmed = []
        tentative = []
        windowStart = 0
        failed = false
        confirmedText = ""
        tentativeText = ""
    }
}

/// 16 kHz samples appended from the audio thread and read from the main actor. Samples before
/// the live window are dropped, so memory stays at about one window however long the recording.
private final class SampleBuffer: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [Float] = []
    /// Absolute index of `storage[0]`.
    private var firstIndex = 0

    func append(_ samples: UnsafeBufferPointer<Float>) {
        lock.lock()
        storage.append(contentsOf: samples)
        lock.unlock()
    }

    /// Samples from absolute index `start` on, and the absolute index they actually start at.
    func samples(from start: Int) -> ([Float], Int) {
        lock.lock()
        defer { lock.unlock() }
        let from = max(start, firstIndex)
        let offset = from - firstIndex
        guard offset < storage.count else { return ([], from) }
        return (Array(storage[offset...]), from)
    }

    func drop(before index: Int) {
        lock.lock()
        defer { lock.unlock() }
        let count = min(max(index - firstIndex, 0), storage.count)
        storage.removeFirst(count)
        firstIndex += count
    }
}
