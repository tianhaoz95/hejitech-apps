import AVFoundation
import CoreMedia
import Foundation
import ScreenCaptureKit

/// Pure audio-mixing utilities for combining microphone and system-audio float buffers into a
/// single 16 kHz mono stream without clipping. Separated from hardware streams for unit testing.
public enum MeetingAudioMixer {
    public static let targetSampleRate: Double = 16_000

    /// Mixes two mono float buffers of potentially different lengths using soft limiting (`tanh`)
    /// so simultaneous local + remote speech never hard-clips.
    public static func mix(mic: [Float], system: [Float]) -> [Float] {
        let count = max(mic.count, system.count)
        guard count > 0 else { return [] }
        var output = [Float](repeating: 0, count: count)
        for i in 0..<count {
            let m: Float = i < mic.count ? mic[i] : 0
            let s: Float = i < system.count ? system[i] : 0
            let sum = m + s
            output[i] = abs(sum) > 0.9 ? tanh(sum) : sum
        }
        return output
    }

    /// Downmixes multi-channel interleaved or non-interleaved float audio to mono and resamples
    /// linearly to `targetSampleRate` (16 kHz).
    public static func toMono16k(samples: [Float], channels: Int, sampleRate: Double, interleaved: Bool) -> [Float] {
        guard !samples.isEmpty, channels > 0, sampleRate > 0 else { return [] }
        let frameCount = samples.count / channels
        guard frameCount > 0 else { return [] }

        var mono = [Float](repeating: 0, count: frameCount)
        if channels == 1 {
            mono = samples
        } else if interleaved {
            let scale = 1.0 / Float(channels)
            for f in 0..<frameCount {
                var acc: Float = 0
                let base = f * channels
                for c in 0..<channels {
                    acc += samples[base + c]
                }
                mono[f] = acc * scale
            }
        } else {
            let scale = 1.0 / Float(channels)
            for f in 0..<frameCount {
                var acc: Float = 0
                for c in 0..<channels {
                    acc += samples[c * frameCount + f]
                }
                mono[f] = acc * scale
            }
        }

        if abs(sampleRate - targetSampleRate) < 1.0 {
            return mono
        }
        let ratio = sampleRate / targetSampleRate
        let outCount = max(1, Int(Double(frameCount) / ratio))
        var resampled = [Float](repeating: 0, count: outCount)
        for i in 0..<outCount {
            let srcPos = Double(i) * ratio
            let idx = Int(srcPos)
            let frac = Float(srcPos - Double(idx))
            let a = mono[min(idx, frameCount - 1)]
            let b = mono[min(idx + 1, frameCount - 1)]
            resampled[i] = a + (b - a) * frac
        }
        return resampled
    }

    /// Normalized 0...1 RMS level suitable for UI audio meters.
    public static func normalizedLevel(for samples: [Float]) -> Float {
        guard !samples.isEmpty else { return 0 }
        var sumSq: Float = 0
        for s in samples { sumSq += s * s }
        let rms = sqrt(sumSq / Float(samples.count))
        let db = 20 * log10(max(rms, 1e-5))
        return max(0, min(1, (db + 60) / 60))
    }
}

/// Captures both macOS system audio (Zoom, Google Meet, Teams, FaceTime, browser audio via
/// `ScreenCaptureKit`) and the local microphone (`AVAudioEngine`) simultaneously into a single
/// 16 kHz mono `.m4a` recording, then runs the full Stage 1 + SpeakerKit Diarization + Stage 2
/// pipeline to produce a speaker-attributed meeting note — with no meeting bot.
@MainActor
public final class MacMeetingRecorderService: ObservableObject {
    @Published public private(set) var isRecording: Bool = false
    @Published public private(set) var isPaused: Bool = false
    @Published public private(set) var isProcessing: Bool = false
    @Published public private(set) var recordingDuration: TimeInterval = 0
    @Published public private(set) var micLevel: Float = 0
    @Published public private(set) var systemLevel: Float = 0
    @Published public var errorMessage: String?

    private let repository: NoteRepository
    private let pipeline: NoteProcessingPipeline
    private let audioFileManager: AudioFileManager

    private var stream: SCStream?
    private var streamOutput: SystemAudioStreamOutput?
    private var audioEngine: AVAudioEngine?
    private var writer: MeetingFileWriter?
    private var currentNoteId: UUID?
    private var currentFileURL: URL?
    private var meterTimer: Timer?
    private var elapsedAccumulated: TimeInterval = 0
    private var segmentStartDate: Date?

    public init(
        repository: NoteRepository,
        pipeline: NoteProcessingPipeline,
        audioFileManager: AudioFileManager
    ) {
        self.repository = repository
        self.pipeline = pipeline
        self.audioFileManager = audioFileManager
    }

    public func startMeetingRecording() async {
        guard !isRecording else { return }
        errorMessage = nil

        let micGranted: Bool = await {
            switch AVCaptureDevice.authorizationStatus(for: .audio) {
            case .authorized: return true
            case .notDetermined: return await AVCaptureDevice.requestAccess(for: .audio)
            default: return false
            }
        }()
        guard micGranted else {
            errorMessage = "Microphone access is required. Enable it in System Settings > Privacy & Security > Microphone."
            return
        }

        let content: SCShareableContent
        do {
            content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        } catch {
            errorMessage = "System audio capture requires Screen & System Audio Recording permission in System Settings > Privacy & Security."
            return
        }

        guard let display = content.displays.first else {
            errorMessage = "No active display found to attach system audio capture."
            return
        }

        let noteId = UUID()
        let fileURL = audioFileManager.newAudioFileURL(for: noteId)
        do {
            let fileWriter = try MeetingFileWriter(url: fileURL)
            self.writer = fileWriter
            self.currentNoteId = noteId
            self.currentFileURL = fileURL

            // 1. Start local microphone capture via AVAudioEngine.
            let engine = AVAudioEngine()
            let inputNode = engine.inputNode
            let inputFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 2048, format: inputFormat) { buffer, _ in
                fileWriter.appendMicBuffer(buffer)
            }
            engine.prepare()
            try engine.start()
            self.audioEngine = engine

            // 2. Start system audio capture via ScreenCaptureKit (audio-only workload).
            let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
            let config = SCStreamConfiguration()
            config.capturesAudio = true
            config.excludesCurrentProcessAudio = true
            config.sampleRate = Int(MeetingAudioMixer.targetSampleRate)
            config.channelCount = 1
            // Minimal video footprint required by SCStream on macOS 14+.
            config.width = 2
            config.height = 2
            config.minimumFrameInterval = CMTime(value: 1, timescale: 1)

            let output = SystemAudioStreamOutput(writer: fileWriter)
            let scStream = SCStream(filter: filter, configuration: config, delegate: nil)
            try scStream.addStreamOutput(output, type: .audio, sampleHandlerQueue: DispatchQueue(label: "com.voxbrief.meeting.system-audio"))
            try await scStream.startCapture()

            self.streamOutput = output
            self.stream = scStream
            self.isRecording = true
            self.isPaused = false
            self.elapsedAccumulated = 0
            self.recordingDuration = 0
            self.segmentStartDate = Date()

            startTimers(writer: fileWriter)
            pipeline.warmUp()
        } catch {
            await cleanupCapture(deleteFile: true)
            errorMessage = "Couldn't start meeting recording: \(error.localizedDescription)"
        }
    }

    public func togglePause() {
        guard isRecording, let writer else { return }
        if isPaused {
            isPaused = false
            segmentStartDate = Date()
            writer.setPaused(false)
        } else {
            isPaused = true
            if let start = segmentStartDate {
                elapsedAccumulated += Date().timeIntervalSince(start)
            }
            segmentStartDate = nil
            writer.setPaused(true)
            micLevel = 0
            systemLevel = 0
        }
    }

    @discardableResult
    public func stopAndProcess() async -> UUID? {
        guard isRecording, let noteId = currentNoteId, let fileURL = currentFileURL else { return nil }
        let finalDuration = currentDuration()
        await cleanupCapture(deleteFile: false)

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            errorMessage = "Meeting audio file was empty."
            return nil
        }

        let audioFileName = "\(noteId.uuidString).\(AudioConstants.fileExtension)"
        let draft = VoiceNote(
            id: noteId,
            createdAt: Date(),
            duration: max(1, finalDuration),
            audioFileName: audioFileName,
            title: "Meeting Recording",
            status: .transcribingASR,
            source: .macMeeting
        )
        repository.save(draft)

        isProcessing = true
        Task { [pipeline] in
            await pipeline.process(note: draft)
            await MainActor.run {
                self.isProcessing = false
            }
        }
        return noteId
    }

    public func cancelRecording() {
        Task {
            await cleanupCapture(deleteFile: true)
        }
    }

    private func currentDuration() -> TimeInterval {
        if let start = segmentStartDate, !isPaused {
            return elapsedAccumulated + Date().timeIntervalSince(start)
        }
        return elapsedAccumulated
    }

    private func startTimers(writer: MeetingFileWriter) {
        meterTimer?.invalidate()
        meterTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRecording else { return }
                self.recordingDuration = self.currentDuration()
                writer.flushChunk()
                let levels = writer.latestLevels()
                self.micLevel = self.isPaused ? 0 : levels.mic
                self.systemLevel = self.isPaused ? 0 : levels.system
            }
        }
    }

    private func cleanupCapture(deleteFile: Bool) async {
        meterTimer?.invalidate()
        meterTimer = nil

        if let engine = audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        audioEngine = nil

        if let scStream = stream {
            try? await scStream.stopCapture()
        }
        stream = nil
        streamOutput = nil

        writer?.finish()
        writer = nil

        if deleteFile, let url = currentFileURL {
            try? FileManager.default.removeItem(at: url)
        }

        isRecording = false
        isPaused = false
        micLevel = 0
        systemLevel = 0
        recordingDuration = 0
        elapsedAccumulated = 0
        segmentStartDate = nil
        currentNoteId = nil
        currentFileURL = nil
    }
}

private final class SystemAudioStreamOutput: NSObject, SCStreamOutput, @unchecked Sendable {
    private let writer: MeetingFileWriter

    init(writer: MeetingFileWriter) {
        self.writer = writer
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, CMSampleBufferDataIsReady(sampleBuffer) else { return }
        writer.appendSystemSampleBuffer(sampleBuffer)
    }
}

/// Thread-safe mixer & `.m4a` file writer for concurrent microphone + system audio streams.
private final class MeetingFileWriter: @unchecked Sendable {
    private let lock = NSLock()
    private var audioFile: AVAudioFile?
    private let pcmFormat: AVAudioFormat
    private var micPending: [Float] = []
    private var systemPending: [Float] = []
    private var micLevel: Float = 0
    private var systemLevel: Float = 0
    private var paused = false

    init(url: URL) throws {
        guard let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: MeetingAudioMixer.targetSampleRate, channels: 1, interleaved: false) else {
            throw NSError(domain: "MeetingFileWriter", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to initialize 16 kHz mono format."])
        }
        self.pcmFormat = format
        self.audioFile = try AVAudioFile(
            forWriting: url,
            settings: AudioConstants.voiceRecordingSettings,
            commonFormat: .pcmFormatFloat32,
            interleaved: false
        )
    }

    func setPaused(_ paused: Bool) {
        lock.lock()
        self.paused = paused
        if paused {
            micPending.removeAll(keepingCapacity: true)
            systemPending.removeAll(keepingCapacity: true)
        }
        lock.unlock()
    }

    func latestLevels() -> (mic: Float, system: Float) {
        lock.lock()
        defer { lock.unlock() }
        return (micLevel, systemLevel)
    }

    func appendMicBuffer(_ buffer: AVAudioPCMBuffer) {
        let frameLength = Int(buffer.frameLength)
        guard frameLength > 0, let channelData = buffer.floatChannelData else { return }
        let channels = Int(buffer.format.channelCount)
        let sampleRate = buffer.format.sampleRate
        var raw = [Float](repeating: 0, count: frameLength * channels)
        if buffer.format.isInterleaved {
            memcpy(&raw, channelData[0], frameLength * channels * MemoryLayout<Float>.size)
        } else {
            for c in 0..<channels {
                let ptr = channelData[c]
                for f in 0..<frameLength {
                    raw[c * frameLength + f] = ptr[f]
                }
            }
        }
        let mono = MeetingAudioMixer.toMono16k(
            samples: raw,
            channels: channels,
            sampleRate: sampleRate,
            interleaved: buffer.format.isInterleaved
        )
        let level = MeetingAudioMixer.normalizedLevel(for: mono)

        lock.lock()
        if !paused {
            micPending.append(contentsOf: mono)
            micLevel = level
        }
        lock.unlock()
    }

    func appendSystemSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
        guard let desc = CMSampleBufferGetFormatDescription(sampleBuffer),
              let asbdPtr = CMAudioFormatDescriptionGetStreamBasicDescription(desc) else { return }
        let asbd = asbdPtr.pointee
        let channels = max(1, Int(asbd.mChannelsPerFrame))
        let sampleRate = asbd.mSampleRate > 0 ? asbd.mSampleRate : MeetingAudioMixer.targetSampleRate
        let isInterleaved = (asbd.mFormatFlags & kAudioFormatFlagIsNonInterleaved) == 0

        var blockBuffer: CMBlockBuffer?
        var bufferListSize = 0
        CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: &bufferListSize,
            bufferListOut: nil,
            bufferListSize: 0,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: 0,
            blockBufferOut: nil
        )
        guard bufferListSize > 0 else { return }
        let rawPtr = UnsafeMutableRawPointer.allocate(byteCount: bufferListSize, alignment: MemoryLayout<AudioBufferList>.alignment)
        defer { rawPtr.deallocate() }
        let audioBufferList = rawPtr.bindMemory(to: AudioBufferList.self, capacity: 1)
        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: audioBufferList,
            bufferListSize: bufferListSize,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
            blockBufferOut: &blockBuffer
        )
        guard status == noErr else { return }

        let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)
        var raw: [Float] = []
        for buf in buffers {
            guard let mData = buf.mData, buf.mDataByteSize > 0 else { continue }
            let count = Int(buf.mDataByteSize) / MemoryLayout<Float>.size
            let floatPtr = mData.assumingMemoryBound(to: Float.self)
            raw.append(contentsOf: UnsafeBufferPointer(start: floatPtr, count: count))
        }
        guard !raw.isEmpty else { return }

        let mono = MeetingAudioMixer.toMono16k(
            samples: raw,
            channels: channels,
            sampleRate: sampleRate,
            interleaved: isInterleaved
        )
        let level = MeetingAudioMixer.normalizedLevel(for: mono)

        lock.lock()
        if !paused {
            systemPending.append(contentsOf: mono)
            systemLevel = level
        }
        lock.unlock()
    }

    func flushChunk() {
        lock.lock()
        let mic = micPending
        let sys = systemPending
        micPending.removeAll(keepingCapacity: true)
        systemPending.removeAll(keepingCapacity: true)
        let file = audioFile
        lock.unlock()

        guard let file else { return }
        let mixed = MeetingAudioMixer.mix(mic: mic, system: sys)
        guard !mixed.isEmpty,
              let pcmBuffer = AVAudioPCMBuffer(pcmFormat: pcmFormat, frameCapacity: AVAudioFrameCount(mixed.count)) else {
            return
        }
        pcmBuffer.frameLength = AVAudioFrameCount(mixed.count)
        if let dst = pcmBuffer.floatChannelData?[0] {
            mixed.withUnsafeBufferPointer { src in
                if let base = src.baseAddress {
                    dst.update(from: base, count: mixed.count)
                }
            }
        }
        try? file.write(from: pcmBuffer)
    }

    func finish() {
        flushChunk()
        lock.lock()
        audioFile = nil
        lock.unlock()
    }
}
