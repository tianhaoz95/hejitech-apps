import AVFoundation
import Foundation
import Speech

/// Which Stage 1 engine transcribes recordings. Whisper (WhisperKit, `base.en`) is the default;
/// Apple Speech (iOS 26's `SpeechAnalyzer` + `SpeechTranscriber`) is an option in Settings: built
/// into iOS, no model download of our own, many languages, made for long recordings. When Apple
/// Speech can't run (older iOS, a language it doesn't have, its assets not installable) the
/// recording falls back to Whisper, so picking it never loses a note.
public enum TranscriptionEngine: String, CaseIterable, Identifiable, Sendable {
    case whisper
    case appleSpeech

    public static let storageKey = "voxbrief_asr_engine"
    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .whisper: return "Whisper"
        case .appleSpeech: return "Apple Speech"
        }
    }

    public static var current: TranscriptionEngine {
        get { UserDefaults.standard.string(forKey: storageKey).flatMap(TranscriptionEngine.init(rawValue:)) ?? .whisper }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: storageKey) }
    }

    /// Apple Speech needs iOS 26's SpeechAnalyzer.
    public static var appleSpeechSupported: Bool {
        if #available(iOS 26.0, *) { return SpeechTranscriber.isAvailable }
        return false
    }
}

/// Stage 1 as the pipeline sees it: routes each transcription to the engine picked in Settings,
/// falling back to Whisper when Apple Speech can't run. Live transcription while recording
/// (`LiveTranscriber`) stays on Whisper.
public actor TranscriptionRouter: ASRServiceProtocol {
    public static let shared = TranscriptionRouter()

    private let whisper: ASRServiceProtocol
    private let engine: @Sendable () -> TranscriptionEngine
    private let apple: (any ASRServiceProtocol)?

    init(
        whisper: ASRServiceProtocol = ASRService.shared,
        apple: (any ASRServiceProtocol)? = nil,
        engine: @escaping @Sendable () -> TranscriptionEngine = { TranscriptionEngine.current }
    ) {
        self.whisper = whisper
        self.engine = engine
        if let apple {
            self.apple = apple
        } else if #available(iOS 26.0, *) {
            self.apple = AppleSpeechTranscriber.shared
        } else {
            self.apple = nil
        }
    }

    public func warmUp() async {
        if engine() == .appleSpeech, let apple { await apple.warmUp() } else { await whisper.warmUp() }
    }

    public func transcribeAudio(at fileURL: URL, vocabulary: [String], onProgress: (@Sendable (String) -> Void)?) async throws -> String {
        try await transcribeAudioWithTimings(at: fileURL, vocabulary: vocabulary, onProgress: onProgress).transcript
    }

    public func transcribeAudioWithTimings(
        at fileURL: URL,
        vocabulary: [String],
        onProgress: (@Sendable (String) -> Void)?
    ) async throws -> (transcript: String, segments: [TranscriptTimingSegment]) {
        if engine() == .appleSpeech, let apple {
            do {
                return try await apple.transcribeAudioWithTimings(at: fileURL, vocabulary: vocabulary, onProgress: onProgress)
            } catch is CancellationError {
                throw CancellationError()
            } catch ASRError.emptyAudio {
                throw ASRError.emptyAudio
            } catch {
                print("[ASR] Apple Speech couldn't transcribe, using Whisper: \(error.localizedDescription)")
            }
        }
        return try await whisper.transcribeAudioWithTimings(at: fileURL, vocabulary: vocabulary, onProgress: onProgress)
    }
}

public enum AppleSpeechError: LocalizedError, Sendable {
    case unavailable
    case unsupportedLanguage(String)

    public var errorDescription: String? {
        switch self {
        case .unavailable: return "Apple Speech isn't available on this device."
        case .unsupportedLanguage(let id): return "Apple Speech doesn't support \(id)."
        }
    }
}

/// Apple Speech: transcribes a whole file with `SpeechAnalyzer` and `SpeechTranscriber`, fully on
/// device. The language is Settings' language, else the device's; its assets are installed by iOS
/// the first time (`AssetInventory`). Personal-dictionary terms go in as contextual strings, the
/// way Whisper gets them as its prompt. Each final result becomes one timed segment.
@available(iOS 26.0, *)
public actor AppleSpeechTranscriber: ASRServiceProtocol {
    public static let shared = AppleSpeechTranscriber()

    /// The locale to transcribe in: Settings' language when it isn't "auto", else the device's,
    /// mapped to one SpeechTranscriber supports.
    static func locale() async throws -> Locale {
        let wanted = ASRService.configuredLanguage.map { Locale(identifier: $0) } ?? Locale.current
        guard let supported = await SpeechTranscriber.supportedLocale(equivalentTo: wanted) else {
            throw AppleSpeechError.unsupportedLanguage(wanted.identifier)
        }
        return supported
    }

    static func makeTranscriber(locale: Locale) -> SpeechTranscriber {
        SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [.audioTimeRange])
    }

    /// Installs the language's model if iOS doesn't have it yet (a one-time download by iOS).
    public static func prepareAssets() async throws {
        guard SpeechTranscriber.isAvailable else { throw AppleSpeechError.unavailable }
        let transcriber = makeTranscriber(locale: try await locale())
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await request.downloadAndInstall()
        }
    }

    public func warmUp() async {
        try? await Self.prepareAssets()
    }

    public func transcribeAudio(at fileURL: URL, vocabulary: [String], onProgress: (@Sendable (String) -> Void)?) async throws -> String {
        try await transcribeAudioWithTimings(at: fileURL, vocabulary: vocabulary, onProgress: onProgress).transcript
    }

    public func transcribeAudioWithTimings(
        at fileURL: URL,
        vocabulary: [String],
        onProgress: (@Sendable (String) -> Void)?
    ) async throws -> (transcript: String, segments: [TranscriptTimingSegment]) {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { throw ASRError.fileNotFound }
        guard SpeechTranscriber.isAvailable else { throw AppleSpeechError.unavailable }
        // No speech-recognition permission needed: SpeechAnalyzer runs on device (checked
        // 2026-11-22 with authorization not determined). The Info.plist string stays in case.

        let transcriber = Self.makeTranscriber(locale: try await Self.locale())
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await request.downloadAndInstall()
        }
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        let terms = Array(vocabulary.prefix(ASRService.maxVocabularyTerms))
        if !terms.isEmpty {
            let context = AnalysisContext()
            context.contextualStrings = [.general: terms]
            try? await analyzer.setContext(context)
        }

        // Read the results while the analyzer works through the file.
        let collect = Task { () -> [TranscriptTimingSegment] in
            var segments: [TranscriptTimingSegment] = []
            var soFar = ""
            for try await result in transcriber.results where result.isFinal {
                let text = String(result.text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { continue }
                let start = result.range.start.seconds
                let end = result.range.end.seconds
                segments.append(TranscriptTimingSegment(
                    start: start.isFinite ? start : 0,
                    end: end.isFinite ? end : (start.isFinite ? start : 0),
                    text: text
                ))
                soFar += (soFar.isEmpty ? "" : " ") + text
                onProgress?(soFar)
            }
            return segments
        }

        do {
            let file = try AVAudioFile(forReading: fileURL)
            if let last = try await analyzer.analyzeSequence(from: file) {
                try await analyzer.finalizeAndFinish(through: last)
            } else {
                await analyzer.cancelAndFinishNow()
            }
        } catch {
            collect.cancel()
            throw ASRError.transcriptionFailed(error.localizedDescription)
        }
        let segments = try await collect.value
        let transcript = segments.map(\.text).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !transcript.isEmpty else { throw ASRError.emptyAudio }
        return (transcript, segments)
    }
}
