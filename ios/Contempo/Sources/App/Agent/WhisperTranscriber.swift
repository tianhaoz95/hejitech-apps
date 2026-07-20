import ContempoCore
import Foundation

/// On-device speech-to-text via sherpa-onnx (k2-fsa/sherpa-onnx). Three
/// bundled Whisper checkpoints, one per `CaptureLanguage` — same reasoning
/// and same model files as Android's `WhisperTranscriber`:
///  - `.english`: the dedicated tiny.en checkpoint (bundled resource
///    `sherpa-onnx-whisper-tiny.en`, int8-quantized) — measurably more
///    accurate on English than the multilingual model forced to English.
///  - `.chinese`: the multilingual tiny checkpoint (`sherpa-onnx-whisper-tiny`),
///    with `language: "zh"` forced — skips Whisper's own per-utterance
///    language-ID step, the actual unreliable part at this model size.
///  - `.auto`: the same multilingual checkpoint, `language: ""` (Whisper's
///    own auto-detection).
///
/// Whisper's forced/detected language is baked into the recognizer config at
/// construction time, so `.chinese` and `.auto` need two separate
/// `SherpaOnnxOfflineRecognizer` instances even though they load the same
/// underlying model files. Each of the three is built lazily on first use
/// and cached for the process's lifetime.
///
/// Record-then-transcribe, not streaming: this is a non-streaming Whisper
/// model — the whole utterance is decoded at once after `AudioRecorder.stop()`.
@MainActor
final class WhisperTranscriber {
    static let sampleRateHz = 16_000

    var isAvailable: Bool {
        let englishEncoder = Bundle.main.path(forResource: "tiny.en-encoder.int8", ofType: "onnx", inDirectory: "sherpa-onnx-whisper-tiny.en")
        let tinyEncoder = Bundle.main.path(forResource: "tiny-encoder.int8", ofType: "onnx", inDirectory: "sherpa-onnx-whisper-tiny")
        return englishEncoder != nil || tinyEncoder != nil
    }

    private lazy var englishRecognizer = Self.buildRecognizer(modelDir: "sherpa-onnx-whisper-tiny.en", filePrefix: "tiny.en", language: "en")
    private lazy var chineseRecognizer = Self.buildRecognizer(modelDir: "sherpa-onnx-whisper-tiny", filePrefix: "tiny", language: "zh")
    private lazy var autoRecognizer = Self.buildRecognizer(modelDir: "sherpa-onnx-whisper-tiny", filePrefix: "tiny", language: "")

    private static func buildRecognizer(modelDir: String, filePrefix: String, language: String) -> SherpaOnnxOfflineRecognizer {
        let encoder = Bundle.main.path(forResource: "\(filePrefix)-encoder.int8", ofType: "onnx", inDirectory: modelDir) ?? ""
        let decoder = Bundle.main.path(forResource: "\(filePrefix)-decoder.int8", ofType: "onnx", inDirectory: modelDir) ?? ""
        let tokens = Bundle.main.path(forResource: "\(filePrefix)-tokens", ofType: "txt", inDirectory: modelDir) ?? ""

        let whisperConfig = sherpaOnnxOfflineWhisperModelConfig(encoder: encoder, decoder: decoder, language: language)
        let modelConfig = sherpaOnnxOfflineModelConfig(tokens: tokens, whisper: whisperConfig, numThreads: 2, modelType: "whisper")
        let featConfig = sherpaOnnxFeatureConfig(sampleRate: sampleRateHz, featureDim: 80)
        var config = sherpaOnnxOfflineRecognizerConfig(featConfig: featConfig, modelConfig: modelConfig)
        return SherpaOnnxOfflineRecognizer(config: &config)
    }

    private func recognizer(for language: CaptureLanguage) -> SherpaOnnxOfflineRecognizer {
        switch language {
        case .english: return englishRecognizer
        case .chinese: return chineseRecognizer
        case .auto: return autoRecognizer
        }
    }

    /// `samples` must be 16kHz mono, normalized to [-1, 1] — see `AudioRecorder`.
    /// Runs the decode inline (on the caller's task) rather than detaching:
    /// the sherpa-onnx wrapper types aren't `Sendable`, so hopping them
    /// across a `Task.detached` boundary isn't safe to do casually. The
    /// decode itself is a blocking native call either way; callers already
    /// invoke this from a background `Task`, not directly from a UI action.
    func transcribe(samples: [Float], language: CaptureLanguage) async -> String {
        guard !samples.isEmpty else { return "" }
        let result = recognizer(for: language).decode(samples: samples, sampleRate: WhisperTranscriber.sampleRateHz)
        return result.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
