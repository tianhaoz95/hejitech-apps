import AVFoundation
import Foundation
import Speech
import RoarlyKit

/// Live, on-device speech to text with Apple's SpeechAnalyzer.
///
/// `SpeechTranscriber` where the iPhone has it, `DictationTranscriber` otherwise (older iPhones).
/// Both report partial ("volatile") text while the storyteller speaks and the final text of each
/// stretch when they pause; the catalog's words are given as context so "rooster" isn't heard as
/// "roaster". Nothing leaves the phone.
@MainActor
final class SpeechListener {
    enum Phase: Equatable {
        case idle
        case downloading(Double)
        case listening
        case failed(String)
    }

    private(set) var phase: Phase = .idle {
        didSet { onPhase?(phase) }
    }
    var onPhase: ((Phase) -> Void)?
    /// (text, isFinal) for each transcription update.
    var onText: ((String, Bool) -> Void)?
    private(set) var engineName = ""

    private var analyzer: SpeechAnalyzer?
    private var continuation: AsyncStream<AnalyzerInput>.Continuation?
    private var resultsTask: Task<Void, Never>?

    static func requestPermissions() async -> Bool {
        let mic = await AVAudioApplication.requestRecordPermission()
        guard mic else { return false }
        let speech = await withCheckedContinuation { (c: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0) }
        }
        // SpeechAnalyzer works on device without it; ask anyway so older systems don't refuse.
        if speech == .denied { log("speech recognition permission denied; trying on-device analyzer anyway") }
        return true
    }

    static var micPermissionGranted: Bool { AVAudioApplication.shared.recordPermission == .granted }

    /// Prepares the model (downloading it once if iOS hasn't yet) and starts listening through
    /// `hub`'s microphone tap.
    func start(hub: AudioHub, vocabulary: [String], language: StoryLanguage) async throws {
        await stop()
        guard let locale = await Self.locale(for: language) else {
            throw NSError(domain: "Roarly", code: 3, userInfo: [NSLocalizedDescriptionKey: "This iPhone can't recognize \(language.englishName) speech yet. Pick another story language in Settings."])
        }
        let module: any SpeechModule
        let results: AsyncThrowingStream<(String, Bool), Error>
        if SpeechTranscriber.isAvailable {
            let t = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults, .fastResults], attributeOptions: [])
            module = t
            engineName = "SpeechTranscriber"
            results = Self.relay(t.results) { (String($0.text.characters), $0.isFinal) }
        } else {
            let t = DictationTranscriber(locale: locale, contentHints: [], transcriptionOptions: [.punctuation], reportingOptions: [.volatileResults], attributeOptions: [])
            module = t
            engineName = "DictationTranscriber"
            results = Self.relay(t.results) { (String($0.text.characters), $0.isFinal) }
        }
        log("speech engine: \(engineName), locale \(locale.identifier)")

        if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
            phase = .downloading(0)
            let progress = request.progress
            let watcher = Task { @MainActor [weak self] in
                while !Task.isCancelled {
                    self?.phase = .downloading(progress.fractionCompleted)
                    try? await Task.sleep(for: .milliseconds(300))
                }
            }
            defer { watcher.cancel() }
            try await request.downloadAndInstall()
        }

        guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module]) else {
            throw NSError(domain: "Roarly", code: 2, userInfo: [NSLocalizedDescriptionKey: "Speech recognition isn't available on this iPhone."])
        }
        let analyzer = SpeechAnalyzer(modules: [module], options: .init(priority: .userInitiated, modelRetention: .processLifetime))
        let context = AnalysisContext()
        context.contextualStrings[.general] = Array(vocabulary.prefix(300))
        try? await analyzer.setContext(context)
        try await analyzer.prepareToAnalyze(in: format)

        let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream(bufferingPolicy: .bufferingNewest(64))
        self.continuation = continuation
        self.analyzer = analyzer

        let feeder = Self.makeFeeder(to: format, continuation: continuation)
        if let file = Self.testAudioFile {
            // Debug: a recorded story through the same analyzer, paced like a microphone.
            try hub.startPlayback()
            try await analyzer.start(inputSequence: stream)
            Self.stream(file: file, into: feeder)
        } else {
            hub.onInput = feeder
            try hub.startListening()
            try await analyzer.start(inputSequence: stream)
        }

        resultsTask = Task { @MainActor [weak self] in
            do {
                for try await (text, isFinal) in results {
                    self?.onText?(text, isFinal)
                }
            } catch {
                log("transcription stopped: \(error)")
                if self?.phase == .listening { self?.phase = .failed(error.localizedDescription) }
            }
        }
        phase = .listening
    }

    func stop() async {
        continuation?.finish()
        continuation = nil
        resultsTask?.cancel()
        resultsTask = nil
        if let analyzer {
            await analyzer.cancelAndFinishNow()
        }
        analyzer = nil
        AudioHub.shared.onInput = nil
        if phase != .idle { phase = .idle }
    }

    /// Updates the speech model's contextual hints while listening (e.g. after editing custom words).
    func updateVocabulary(_ vocabulary: [String]) {
        guard let analyzer else { return }
        let context = AnalysisContext()
        context.contextualStrings[.general] = Array(vocabulary.prefix(300))
        Task { try? await analyzer.setContext(context) }
    }

    /// `-listenFile <name>`: a recording in the app's Documents folder instead of the microphone.
    static var testAudioFile: URL? {
        #if DEBUG
        guard let name = DebugFlags.value("-listenFile") else { return nil }
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent(name)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
        #else
        return nil
        #endif
    }

    nonisolated private static func stream(file url: URL, into feed: @escaping @Sendable (AVAudioPCMBuffer, AVAudioTime) -> Void) {
        Thread.detachNewThread {
            guard let f = try? AVAudioFile(forReading: url) else { log("can't read \(url.lastPathComponent)"); return }
            let chunk: AVAudioFrameCount = 2048
            let seconds = Double(chunk) / f.processingFormat.sampleRate
            log("streaming \(url.lastPathComponent) (\(Int(Double(f.length) / f.processingFormat.sampleRate)) s)")
            while f.framePosition < f.length {
                guard let b = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: chunk) else { return }
                do { try f.read(into: b, frameCount: chunk) } catch { return }
                feed(b, AVAudioTime(sampleTime: f.framePosition, atRate: f.processingFormat.sampleRate))
                Thread.sleep(forTimeInterval: seconds)
            }
            log("test audio finished")
        }
    }

    /// The phone's own locale when it speaks the story's language (its region, e.g. es-MX), else
    /// the locales the language's lexicon lists, in order.
    private static func locale(for language: StoryLanguage) async -> Locale? {
        var candidates = language.speechLocales.map(Locale.init(identifier:))
        if StoryLanguage.matching(languageCode: Locale.current.language.languageCode?.identifier) == language {
            candidates.insert(Locale.current, at: 0)
        }
        for c in candidates {
            if SpeechTranscriber.isAvailable {
                if let l = await SpeechTranscriber.supportedLocale(equivalentTo: c) { return l }
            } else if let l = await DictationTranscriber.supportedLocale(equivalentTo: c) {
                return l
            }
        }
        return nil
    }

    private static func relay<S: AsyncSequence & Sendable, R>(_ seq: S, _ map: @escaping @Sendable (R) -> (String, Bool)) -> AsyncThrowingStream<(String, Bool), Error> where S.Element == R {
        AsyncThrowingStream { c in
            let task = Task {
                do {
                    for try await r in seq { c.yield(map(r)) }
                    c.finish()
                } catch {
                    c.finish(throwing: error)
                }
            }
            c.onTermination = { _ in task.cancel() }
        }
    }

    /// Converts microphone buffers to the analyzer's format (audio thread).
    nonisolated private static func makeFeeder(to format: AVAudioFormat, continuation: AsyncStream<AnalyzerInput>.Continuation) -> @Sendable (AVAudioPCMBuffer, AVAudioTime) -> Void {
        let box = ConverterBox()
        return { buffer, _ in
            if box.converter == nil || box.from != buffer.format {
                box.converter = AVAudioConverter(from: buffer.format, to: format)
                box.from = buffer.format
            }
            guard let converter = box.converter else { return }
            let ratio = format.sampleRate / buffer.format.sampleRate
            guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 64) else { return }
            var given = false
            var error: NSError?
            converter.convert(to: out, error: &error) { _, status in
                if given { status.pointee = .noDataNow; return nil }
                given = true
                status.pointee = .haveData
                return buffer
            }
            if error == nil, out.frameLength > 0 { continuation.yield(AnalyzerInput(buffer: out)) }
        }
    }
}

private final class ConverterBox: @unchecked Sendable {
    var converter: AVAudioConverter?
    var from: AVAudioFormat?
}
