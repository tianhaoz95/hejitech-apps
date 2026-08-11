import ContempoCore
import Foundation

/// On-device speech-to-text via sherpa-onnx (k2-fsa/sherpa-onnx). Three
/// recognizers, one per `CaptureLanguage`, backed by two On-Demand Resource
/// tags (see project.yml's `resourceTags`/`NSBundleResourceRequest*Tags`) —
/// same reasoning and same model files as Android's `WhisperTranscriber`:
///  - `.english`: the dedicated tiny.en checkpoint (tag `whisper-tiny-en`,
///    int8-quantized) — measurably more accurate on English than the
///    multilingual model forced to English.
///  - `.chinese`: the multilingual tiny checkpoint (tag
///    `whisper-tiny-multilingual`), with `language: "zh"` forced — skips
///    Whisper's own per-utterance language-ID step, the actual unreliable
///    part at this model size.
///  - `.auto`: the same multilingual checkpoint, `language: ""` (Whisper's
///    own auto-detection).
///
/// Both tags are `NSBundleResourceRequestInitialInstallTags`, so they
/// download automatically right after install exactly like fully-bundled
/// resources — this is not a true on-demand/lazy fetch, just ODR's
/// mechanism for keeping these ~99MB-each, essentially-static files out of
/// routine app-update deltas. `NSBundleResourceRequest.beginAccessingResources()`
/// is still required to resolve a valid on-disk path even for Initial
/// Install tags (Apple's ODR API contract — the exact storage location
/// isn't guaranteed outside it), so recognizer construction is async and
/// gated behind `preparationTask`.
///
/// Whisper's forced/detected language is baked into the recognizer config at
/// construction time, so `.chinese` and `.auto` need two separate
/// `SherpaOnnxOfflineRecognizer` instances even though they load the same
/// underlying model files. All three are built once, during `init`, and
/// cached for the process's lifetime.
///
/// Record-then-transcribe, not streaming: this is a non-streaming Whisper
/// model — the whole utterance is decoded at once after `AudioRecorder.stop()`.
@Observable
@MainActor
final class WhisperTranscriber {
    static let sampleRateHz = 16_000

    private static let englishTag = "whisper-tiny-en"
    private static let multilingualTag = "whisper-tiny-multilingual"

    private(set) var status: OnDeviceModelUiStatus = .checking

    var isAvailable: Bool { status == .available }

    private var englishRecognizer: SherpaOnnxOfflineRecognizer?
    private var chineseRecognizer: SherpaOnnxOfflineRecognizer?
    private var autoRecognizer: SherpaOnnxOfflineRecognizer?

    // Kept alive for the process's lifetime — NSBundleResourceRequest may
    // purge access once the request object is deallocated.
    private var englishResourceRequest: NSBundleResourceRequest?
    private var multilingualResourceRequest: NSBundleResourceRequest?

    private var preparationTask: Task<Void, Never>?

    init() {
        preparationTask = Task { await prepareRecognizers() }
    }

    /// User-triggered from Settings after a `.failed` status.
    func retry() {
        preparationTask = Task { await prepareRecognizers() }
    }

    private func prepareRecognizers() async {
        status = .checking
        do {
            let englishRequest = try await Self.accessResources(tag: Self.englishTag)
            let multilingualRequest = try await Self.accessResources(tag: Self.multilingualTag)
            englishResourceRequest = englishRequest
            multilingualResourceRequest = multilingualRequest
            englishRecognizer = Self.buildRecognizer(bundle: englishRequest.bundle, modelDir: "sherpa-onnx-whisper-tiny.en", filePrefix: "tiny.en", language: "en")
            chineseRecognizer = Self.buildRecognizer(bundle: multilingualRequest.bundle, modelDir: "sherpa-onnx-whisper-tiny", filePrefix: "tiny", language: "zh")
            autoRecognizer = Self.buildRecognizer(bundle: multilingualRequest.bundle, modelDir: "sherpa-onnx-whisper-tiny", filePrefix: "tiny", language: "")
            status = .available
        } catch {
            status = .failed(message: error.localizedDescription)
        }
    }

    private static func accessResources(tag: String) async throws -> NSBundleResourceRequest {
        let request = NSBundleResourceRequest(tags: [tag])
        try await request.beginAccessingResources()
        return request
    }

    private static func buildRecognizer(bundle: Bundle, modelDir: String, filePrefix: String, language: String) -> SherpaOnnxOfflineRecognizer {
        let encoder = bundle.path(forResource: "\(filePrefix)-encoder.int8", ofType: "onnx", inDirectory: modelDir) ?? ""
        let decoder = bundle.path(forResource: "\(filePrefix)-decoder.int8", ofType: "onnx", inDirectory: modelDir) ?? ""
        let tokens = bundle.path(forResource: "\(filePrefix)-tokens", ofType: "txt", inDirectory: modelDir) ?? ""

        let whisperConfig = sherpaOnnxOfflineWhisperModelConfig(encoder: encoder, decoder: decoder, language: language)
        let modelConfig = sherpaOnnxOfflineModelConfig(tokens: tokens, whisper: whisperConfig, numThreads: 2, modelType: "whisper")
        let featConfig = sherpaOnnxFeatureConfig(sampleRate: sampleRateHz, featureDim: 80)
        var config = sherpaOnnxOfflineRecognizerConfig(featConfig: featConfig, modelConfig: modelConfig)
        return SherpaOnnxOfflineRecognizer(config: &config)
    }

    private func recognizer(for language: CaptureLanguage) -> SherpaOnnxOfflineRecognizer? {
        switch language {
        case .english: return englishRecognizer
        case .chinese: return chineseRecognizer
        case .auto: return autoRecognizer
        }
    }

    /// `samples` must be 16kHz mono, normalized to [-1, 1] — see `AudioRecorder`.
    /// Awaits ODR resource access first (a no-op after the first successful
    /// call, since `preparationTask`'s result is cached) — in practice this
    /// resolves near-instantly since both tags are Initial Install, but a
    /// slow first launch or a purged cache could still make this a real
    /// wait. Runs the decode inline (on the caller's task) rather than
    /// detaching: the sherpa-onnx wrapper types aren't `Sendable`, so
    /// hopping them across a `Task.detached` boundary isn't safe to do
    /// casually. The decode itself is a blocking native call either way;
    /// callers already invoke this from a background `Task`, not directly
    /// from a UI action.
    func transcribe(samples: [Float], language: CaptureLanguage) async -> String {
        guard !samples.isEmpty else { return "" }
        await preparationTask?.value
        guard let recognizer = recognizer(for: language) else { return "" }
        let result = recognizer.decode(samples: samples, sampleRate: WhisperTranscriber.sampleRateHz)
        return result.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
