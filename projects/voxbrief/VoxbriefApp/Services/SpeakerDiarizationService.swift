import Foundation
import AVFoundation
import SpeakerKit
import WhisperKit

/// Speaker detection (diarization) on the iPhone with SpeakerKit (pyannote models on CoreML,
/// ~11 MB, downloaded once from Hugging Face like the Whisper model, then cached). A recording is
/// read in windows so hours of audio are never held in memory at once, and the speakers of each
/// window are matched to the ones before by voice (`SpeakerLinker`).
public actor SpeakerDiarizationService: SpeakerDetecting {
    public static let shared = SpeakerDiarizationService()

    /// 15 minutes of 16 kHz samples is ~58 MB of floats.
    static let windowSeconds: Double = 15 * 60

    private var kit: SpeakerKit?
    private var loadTask: Task<SpeakerKit, Error>?

    public init() {}

    public func speakerSpans(forAudioAt url: URL) async throws -> [SpeakerSpan] {
        let duration = try Self.duration(of: url)
        guard duration > 1 else { return [] }
        let kit = try await loadedKit()

        var linker = SpeakerLinker()
        var spans: [SpeakerSpan] = []
        for (windowStart, windowEnd) in Self.windows(duration: duration, maximum: Self.windowSeconds) {
            try Task.checkCancellation()
            let samples = try AudioProcessor.loadAudioAsFloatArray(fromPath: url.path, startTime: windowStart, endTime: windowEnd)
            if samples.count >= WhisperKit.sampleRate {
                let result = try await kit.diarize(audioArray: samples)
                var mapping = linker.link(result.speakerCentroidEmbeddings)
                for segment in result.segments {
                    guard let local = segment.speaker.speakerId else { continue }
                    let speaker = mapping[local] ?? {
                        let new = linker.newSpeaker()
                        mapping[local] = new
                        return new
                    }()
                    spans.append(SpeakerSpan(
                        start: windowStart + Double(segment.startTime),
                        end: windowStart + Double(segment.endTime),
                        speaker: speaker
                    ))
                }
            }
        }
        return spans
    }

    /// Equal windows of at most `maximum` seconds: a short last window holds too little of each
    /// voice to tell them apart (both were taken for one new speaker in testing).
    static func windows(duration: Double, maximum: Double) -> [(start: Double, end: Double)] {
        let count = max(1, Int((duration / maximum).rounded(.up)))
        let size = duration / Double(count)
        return (0..<count).map { (Double($0) * size, $0 == count - 1 ? duration : Double($0 + 1) * size) }
    }

    /// Frees the models (memory warning, app in the background); the next call loads them again.
    public func unload() async {
        loadTask?.cancel()
        loadTask = nil
        if let kit { await kit.unloadModels() }
        kit = nil
    }

    private func loadedKit() async throws -> SpeakerKit {
        if let kit { return kit }
        if let loadTask { return try await loadTask.value }
        let task = Task { try await SpeakerKit(PyannoteConfig(download: true, load: true, verbose: false)) }
        loadTask = task
        do {
            let loaded = try await task.value
            kit = loaded
            loadTask = nil
            return loaded
        } catch {
            loadTask = nil
            throw error
        }
    }

    private static func duration(of url: URL) throws -> Double {
        let file = try AVAudioFile(forReading: url)
        return Double(file.length) / file.fileFormat.sampleRate
    }
}
