import AVFoundation
import ContempoCore
import Foundation
import Observation
import Speech

/// Which on-device speech engine transcribes voice captures on iOS.
/// Whisper (sherpa-onnx) is the default; Apple Speech (iOS 26+ `SpeechAnalyzer`) is an opt-in
/// zero-download engine that automatically falls back to Whisper if unavailable or if an utterance fails.
enum SpeechEngine: String, CaseIterable, Identifiable {
    case whisper
    case appleSpeech

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .whisper: return "Whisper (Bundled)"
        case .appleSpeech: return "Apple Speech (iOS 26+)"
        }
    }

    static var appleSpeechSupported: Bool {
        if #available(iOS 26.0, *) { return SpeechTranscriber.isAvailable }
        return false
    }
}

@Observable
@MainActor
final class SpeechEngineStore {
    private static let key = "contempo_speech_engine"
    private(set) var engine: SpeechEngine

    init() {
        let saved = UserDefaults.standard.string(forKey: Self.key).flatMap(SpeechEngine.init(rawValue:))
        self.engine = saved ?? .whisper
    }

    func set(_ next: SpeechEngine) {
        engine = next
        UserDefaults.standard.set(next.rawValue, forKey: Self.key)
    }
}

@available(iOS 26.0, *)
enum AppleSpeechTranscriber {
    /// Transcribe 16 kHz mono Float PCM samples via iOS 26's `SpeechAnalyzer` + `SpeechTranscriber`.
    static func transcribe(samples: [Float], language: CaptureLanguage) async throws -> String {
        guard !samples.isEmpty else { return "" }
        let locale: Locale = switch language {
        case .english: Locale(identifier: "en-US")
        case .chinese: Locale(identifier: "zh-CN")
        case .auto: Locale.current
        }
        guard let supported = await SpeechTranscriber.supportedLocale(equivalentTo: locale) else {
            throw NSError(domain: "AppleSpeech", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unsupported locale"])
        }

        let tmpURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("contempo-asr-\(UUID().uuidString).wav")
        defer { try? FileManager.default.removeItem(at: tmpURL) }
        try writeWav(samples: samples, sampleRate: Double(WhisperTranscriber.sampleRateHz), to: tmpURL)

        let transcriber = SpeechTranscriber(locale: supported, preset: .transcription)
        let analyzer = SpeechAnalyzer(modules: [transcriber])

        async let collected: String = {
            var parts: [String] = []
            for try await result in transcriber.results {
                if result.isFinal {
                    parts.append(String(result.text.characters))
                }
            }
            return parts.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        }()

        let file = try AVAudioFile(forReading: tmpURL)
        try await analyzer.start(inputAudioFile: file, finishAfterFile: true)
        return try await collected
    }

    private static func writeWav(samples: [Float], sampleRate: Double, to url: URL) throws {
        guard let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 1, interleaved: false),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count))
        else {
            throw NSError(domain: "AppleSpeech", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not allocate audio buffer"])
        }
        buffer.frameLength = AVAudioFrameCount(samples.count)
        if let channel = buffer.floatChannelData?[0] {
            samples.withUnsafeBufferPointer { src in
                guard let base = src.baseAddress else { return }
                channel.update(from: base, count: samples.count)
            }
        }
        let file = try AVAudioFile(forWriting: url, settings: format.settings, commonFormat: .pcmFormatFloat32, interleaved: false)
        try file.write(from: buffer)
    }
}
