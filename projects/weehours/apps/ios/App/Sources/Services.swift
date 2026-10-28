import AVFoundation
import Foundation
import LayaRuntime
import LogCore
import Security
import Translation
import UserNotifications
import WhisperKit
#if canImport(ActivityKit)
import ActivityKit
#endif

// MARK: - Keychain (auth session)

enum Keychain {
    static func set(_ data: Data?, for key: String) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key]
        SecItemDelete(q as CFDictionary)
        guard let data else { return }
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static func get(_ key: String) -> Data? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key,
                                kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: CFTypeRef?
        return SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }
}

// MARK: - Voice recorder (16 kHz mono WAV, what Whisper wants, plus live 16 kHz float tap)

final class Recorder: NSObject, @unchecked Sendable {
    private var recorder: AVAudioRecorder?
    private var engine: AVAudioEngine?
    private let lock = NSLock()
    private var liveSamples: [Float] = []
    private(set) var url: URL?

    func start() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
        try session.setActive(true)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("utterance-\(UUID().uuidString).wav")
        let settings: [String: Any] = [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 16_000, AVNumberOfChannelsKey: 1,
                                       AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false]
        recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder?.isMeteringEnabled = true
        recorder?.record()
        self.url = url

        lock.lock()
        liveSamples.removeAll(keepingCapacity: true)
        lock.unlock()
        startTap()
    }

    private func startTap() {
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let inFormat = input.outputFormat(forBus: 0)
        guard inFormat.sampleRate > 0, inFormat.channelCount > 0,
              let outFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16_000, channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: inFormat, to: outFormat) else { return }

        input.installTap(onBus: 0, bufferSize: 4096, format: inFormat) { [weak self] pcm, _ in
            guard let self else { return }
            let capacity = AVAudioFrameCount(Double(pcm.frameLength) * 16_000 / inFormat.sampleRate) + 64
            guard let out = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: capacity) else { return }
            var supplied = false
            var error: NSError?
            converter.convert(to: out, error: &error) { _, status in
                if supplied { status.pointee = .noDataNow; return nil }
                supplied = true
                status.pointee = .haveData
                return pcm
            }
            if error == nil, let channel = out.floatChannelData?[0], out.frameLength > 0 {
                let buf = UnsafeBufferPointer(start: channel, count: Int(out.frameLength))
                self.lock.lock()
                self.liveSamples.append(contentsOf: buf)
                self.lock.unlock()
            }
        }
        do {
            engine.prepare()
            try engine.start()
            self.engine = engine
        } catch {
            input.removeTap(onBus: 0)
        }
    }

    private func stopTap() {
        guard let engine else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        self.engine = nil
    }

    func samples() -> [Float] {
        lock.lock()
        let copy = liveSamples
        lock.unlock()
        if !copy.isEmpty { return copy }
        // Fallback: read raw 16-bit PCM samples directly from the active WAV file (skipping the 44-byte header)
        guard let url, let data = try? Data(contentsOf: url), data.count > 44 else { return [] }
        let pcm = data.subdata(in: 44..<data.count)
        let count = pcm.count / 2
        return pcm.withUnsafeBytes { raw in
            guard let ptr = raw.baseAddress?.assumingMemoryBound(to: Int16.self) else { return [] }
            var out = [Float](repeating: 0, count: count)
            for i in 0..<count {
                out[i] = Float(Int16(littleEndian: ptr[i])) / 32768.0
            }
            return out
        }
    }

    func stop() -> URL? {
        stopTap()
        recorder?.stop()
        recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return url
    }

    /// The input level right now, 0 (silence, -50 dB and below) to 1, for the listening waveform.
    func level() -> Float {
        guard let recorder else { return 0 }
        recorder.updateMeters()
        return max(0, min(1, (recorder.averagePower(forChannel: 0) + 50) / 50))
    }
}

// MARK: - On-device transcription (WhisperKit, as in voxbrief)

/// Settings → Voice → Language (per phone, English by default). English runs exactly as before on
/// the bundled base.en. Any other language uses one downloaded multilingual Whisper that writes
/// down what was said, then Apple's on-device Translation turns it into English, so Laya, the
/// parsers and the keyword fallback (all English) run unchanged. Without Translation (before
/// iOS 26, or the language not downloaded) Whisper translates by itself, which loses more words
/// ("pañal mojado" → "wet cloth"). Dictated notes aren't translated: they keep the spoken language.
enum VoiceLanguage: String, CaseIterable, Identifiable, Sendable {
    case english = "en", spanish = "es", chinese = "zh"
    static let key = "voiceLanguage"
    var id: String { rawValue }
    var title: String {
        switch self {
        case .english: "English"
        case .spanish: "Español"
        case .chinese: "中文"
        }
    }
    var translates: Bool { self != .english }
    /// The Translation framework's name for the language (Whisper writes simplified Chinese when prompted).
    var translationLanguage: Locale.Language { Locale.Language(identifier: self == .chinese ? "zh-Hans" : rawValue) }
    static var current: VoiceLanguage {
        UserDefaults.standard.string(forKey: key).flatMap(VoiceLanguage.init(rawValue:)) ?? .english
    }
}

/// The multilingual Whisper for languages other than English: bundled with the app
/// (scripts/fetch-models.sh), so it works offline right after install. Builds without it
/// download it once into Application Support.
@MainActor
final class SpeechModelManager: ObservableObject {
    nonisolated static let variant = "openai_whisper-small_216MB"
    @Published var progress: Double?
    @Published var error: String?
    @Published private(set) var isDownloaded = SpeechModelManager.isReady

    nonisolated static var base: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("whisper")
    }
    /// Where WhisperKit's hub download puts the variant (and the tokenizer under models/openai/).
    nonisolated static var folder: URL { base.appendingPathComponent("models/argmaxinc/whisperkit-coreml/\(variant)") }
    nonisolated static var isReady: Bool { bundled != nil || FileManager.default.fileExists(atPath: folder.appendingPathComponent(".complete").path) }

    /// The copy shipped in the app bundle: model folder and tokenizer folder.
    nonisolated static var bundled: (model: URL, tokenizer: URL)? {
        guard let root = Bundle.main.url(forResource: "Models", withExtension: nil)?.appendingPathComponent("whisper") else { return nil }
        let model = root.appendingPathComponent(variant)
        guard FileManager.default.fileExists(atPath: model.appendingPathComponent("AudioEncoder.mlmodelc").path) else { return nil }
        return (model, root.appendingPathComponent("tokenizer-multi"))
    }
    var isBundled: Bool { Self.bundled != nil }

    func download() async {
        guard progress == nil, !Self.isReady else { isDownloaded = Self.isReady; return }
        progress = 0
        error = nil
        do {
            var base = Self.base
            try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? base.setResourceValues(values)
            let folder = try await WhisperKit.download(variant: Self.variant, downloadBase: Self.base) { [weak self] p in
                let f = p.fractionCompleted
                Task { @MainActor in if self?.progress != nil { self?.progress = f } }
            }
            try Data().write(to: folder.appendingPathComponent(".complete"))
            isDownloaded = true
        } catch {
            self.error = error.localizedDescription
        }
        progress = nil
    }
}

@MainActor
enum SpeechModelHolder {
    static var shared = SpeechModelManager()
}

struct SpeechModelMissing: LocalizedError {
    let language: VoiceLanguage
    var errorDescription: String? { "The \(language.title) speech model isn't on this iPhone yet. Download it in Settings → Voice." }
}

/// Apple's on-device Translation into English (iOS 26: a session without a view). Nil when it
/// can't run, so the caller falls back to Whisper's own translation.
enum VoiceTranslator {
    static let english = Locale.Language(identifier: "en")

    /// Translation can run here: iOS 26 and the language downloaded (Settings → Voice offers it).
    static func isReady(_ language: VoiceLanguage) async -> Bool {
        guard #available(iOS 26.0, *) else { return false }
        return await LanguageAvailability().status(from: language.translationLanguage, to: english) == .installed
    }

    static func english(_ text: String, from language: VoiceLanguage) async -> String? {
        guard #available(iOS 26.0, *), await isReady(language) else { return nil }
        let session = TranslationSession(installedSource: language.translationLanguage, target: english)
        guard let out = try? await session.translate(text).targetText, !out.isEmpty else { return nil }
        return out
    }
}

actor WhisperTranscriber: Transcriber {
    /// The loaded pipeline and which model it is: "en" (bundled base.en) or "multi".
    private var pipe: (key: String, kit: WhisperKit)?
    private var loading: (key: String, task: Task<WhisperKit, Error>)?
    let model: String

    init(model: String = "base.en") { self.model = model }

    func warmUp() async { _ = try? await loaded(for: VoiceLanguage.current) }

    /// The Core ML model and tokenizer shipped in the app bundle (scripts/fetch-models.sh).
    static var bundledFolders: (model: URL, tokenizer: URL)? {
        guard let root = Bundle.main.url(forResource: "Models", withExtension: nil)?.appendingPathComponent("whisper") else { return nil }
        let model = root.appendingPathComponent("openai_whisper-base.en")
        let tokenizer = root.appendingPathComponent("tokenizer")
        guard FileManager.default.fileExists(atPath: model.appendingPathComponent("AudioEncoder.mlmodelc").path) else { return nil }
        return (model, tokenizer)
    }

    private func loaded(for language: VoiceLanguage) async throws -> WhisperKit {
        let key = language.translates ? "multi" : "en"
        if let pipe, pipe.key == key { return pipe.kit }
        if let loading, loading.key == key { return try await loading.task.value }
        let config: WhisperKitConfig
        if language.translates {
            if let bundled = SpeechModelManager.bundled {
                config = WhisperKitConfig(modelFolder: bundled.model.path, tokenizerFolder: bundled.tokenizer, verbose: false, download: false)
            } else {
                guard SpeechModelManager.isReady else { throw SpeechModelMissing(language: language) }
                // the tokenizer comes from the hub on the first load and is kept under `base`
                config = WhisperKitConfig(modelFolder: SpeechModelManager.folder.path, tokenizerFolder: SpeechModelManager.base,
                                          verbose: false, download: false)
            }
        } else if let bundled = Self.bundledFolders {
            config = WhisperKitConfig(modelFolder: bundled.model.path, tokenizerFolder: bundled.tokenizer, verbose: false, download: false)
        } else {
            config = WhisperKitConfig(model: model, verbose: false)   // first use downloads from Hugging Face
        }
        let task = Task { try await WhisperKit(config) }
        loading = (key, task)
        defer { if loading?.key == key { loading = nil } }
        let p = try await task.value
        pipe = (key, p)   // only one model in memory: switching language drops the other
        return p
    }

    private static let vocabPrompt = "bottle, breastfeeding, nursing, diaper, wet, dirty, poop, asleep, woke up, quarter, half, three quarters, left, right, switched sides"

    /// The voice pipeline's Whisper options. English: the closed vocabulary, so "poopy" and "three
    /// quarters" come out right. Other languages, when Translation can't help: Whisper's own
    /// translation, with the same English prompt since its output is English.
    private func pipelineOptions(_ p: WhisperKit, _ language: VoiceLanguage) -> DecodingOptions {
        DecodingOptions(task: language.translates ? .translate : .transcribe, language: language.rawValue,
                        promptTokens: p.tokenizer?.encode(text: " " + Self.vocabPrompt))
    }

    /// Other languages: what was said, in that language, prompted with its own baby vocabulary.
    private func verbatimOptions(_ p: WhisperKit, _ language: VoiceLanguage) -> DecodingOptions {
        // Whisper mixes simplified and traditional characters unless the context is simplified
        let prompt = language == .chinese ? "以下是普通话的句子。奶瓶，尿布，母乳，睡着了，醒了。" : "biberón, pañal, mojado, sucio, mamar, se durmió, se despertó"
        return DecodingOptions(task: .transcribe, language: language.rawValue, promptTokens: p.tokenizer?.encode(text: prompt))
    }

    /// For the voice pipeline: English text, whatever the phone's voice language.
    func transcribe(fileURL: URL) async throws -> String {
        try await transcribeSpoken(fileURL: fileURL).english
    }

    /// English for the decision layer, plus the words as spoken in another language, which the
    /// entry keeps next to the English (`VoiceTranscript.display`).
    func transcribeSpoken(fileURL: URL) async throws -> (english: String, spoken: String?) {
        let language = VoiceLanguage.current
        let p = try await loaded(for: language)
        guard language.translates else {
            return (Self.join(try await p.transcribe(audioPath: fileURL.path, decodeOptions: pipelineOptions(p, language))), nil)
        }
        let said = Self.join(try await p.transcribe(audioPath: fileURL.path, decodeOptions: verbatimOptions(p, language)))
        if said.isEmpty { return ("", nil) }
        if let english = await VoiceTranslator.english(said, from: language) { return (english, said) }
        // no Translation here: Whisper translates the audio itself (a second pass)
        return (Self.join(try await p.transcribe(audioPath: fileURL.path, decodeOptions: pipelineOptions(p, language))), said)
    }

    /// Dictated notes: the words as spoken, in the phone's voice language (never translated).
    func transcribeVerbatim(fileURL: URL) async throws -> String {
        let language = VoiceLanguage.current
        guard language.translates else { return try await transcribe(fileURL: fileURL) }
        let p = try await loaded(for: language)
        return Self.cleanLiveText(Self.join(try await p.transcribe(audioPath: fileURL.path, decodeOptions: verbatimOptions(p, language))))
    }

    /// Live preview transcription directly from in-memory 16 kHz mono samples while recording.
    /// Other languages show what's being said, untranslated (translating every 750 ms would flicker).
    func transcribe(samples: [Float]) async throws -> String {
        guard samples.count >= 8_000 else { return "" }
        let language = VoiceLanguage.current
        let p = try await loaded(for: language)
        let options = language.translates ? verbatimOptions(p, language) : pipelineOptions(p, language)
        let results = try await p.transcribe(audioArray: samples, decodeOptions: options)
        return Self.cleanLiveText(results.map(\.text).joined(separator: " "))
    }

    private static func join(_ results: [TranscriptionResult]) -> String {
        results.map(\.text).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func cleanLiveText(_ raw: String) -> String {
        let stripped = raw.replacingOccurrences(of: #"\[[^\]]*\]|\([^\)]*\)"#, with: "", options: .regularExpression)
        return stripped.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - Decision model choice

enum DecisionBackend: String, CaseIterable, Identifiable, Codable {
    case onDevice = "On-device Laya"
    case devServer = "Laya on Mac (llama-server)"
    case keywords = "Keyword fallback"
    var id: String { rawValue }
}

@MainActor
final class ModelManager: ObservableObject {
    static let modelURL = URL(string: "https://huggingface.co/tianhaoz95/wee-hours-baby-activity/resolve/groups2/Laya-ft-Q8_0.gguf")!
    @Published var progress: Double?
    @Published var error: String?

    static var localFile: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("models")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("Laya-Q8_0.gguf")
    }

    /// Shipped inside the app (scripts/fetch-models.sh), so voice works offline right after install.
    static var bundledFile: URL? {
        Bundle.main.url(forResource: "Models", withExtension: nil)
            .map { $0.appendingPathComponent("Laya-Q8_0.gguf") }
            .flatMap { FileManager.default.fileExists(atPath: $0.path) ? $0 : nil }
    }

    /// The bundled model, else a downloaded copy.
    static var modelFile: URL? {
        bundledFile ?? (FileManager.default.fileExists(atPath: localFile.path) ? localFile : nil)
    }

    var isBundled: Bool { Self.bundledFile != nil }
    var isDownloaded: Bool { Self.modelFile != nil }

    /// ~450 MB, downloaded once on Wi-Fi; never bundled in the app binary.
    func download() async {
        progress = 0
        error = nil
        do {
            let (tmp, resp) = try await URLSession.shared.download(from: Self.modelURL)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            try? FileManager.default.removeItem(at: Self.localFile)
            try FileManager.default.moveItem(at: tmp, to: Self.localFile)
            progress = nil
        } catch {
            self.error = error.localizedDescription
            progress = nil
        }
    }

    func model(for backend: DecisionBackend, devServer: String) -> DecisionModel {
        switch backend {
        case .onDevice where isDownloaded: return LayaDecisionModel(modelURL: Self.modelFile!)
        case .devServer: return SystemOneHTTPModel(endpoint: URL(string: devServer) ?? URL(string: "http://127.0.0.1:8089")!)
        default: return KeywordDecisionModel()
        }
    }
}

// MARK: - Reminders → local notifications

enum ReminderScheduler {
    static func registerCategories() {
        let snooze15 = UNNotificationAction(identifier: "SNOOZE_15", title: "Snooze 15 min", options: [])
        let snooze30 = UNNotificationAction(identifier: "SNOOZE_30", title: "Snooze 30 min", options: [])
        let startFeed = UNNotificationAction(identifier: "START_FEED", title: "Start feed", options: [.foreground])
        let category = UNNotificationCategory(identifier: "reminder", actions: [startFeed, snooze15, snooze30], intentIdentifiers: [])
        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    static func requestPermission() async {
        registerCategories()
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge, .timeSensitive])
    }

    /// Replaces scheduled reminders with the current plan for this caregiver.
    static func apply(_ plan: [PlannedReminder]) {
        Task {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
            schedule(plan, center)
        }
    }

    private static func schedule(_ plan: [PlannedReminder], _ center: UNUserNotificationCenter) {
        center.removeAllPendingNotificationRequests()
        for r in plan {
            let content = UNMutableNotificationContent()
            content.title = r.kind == .feed || r.kind == .stillFeeding ? "Feed" : r.kind == .diaper ? "Diaper" : "Wee Hours"
            content.body = r.message
            content.categoryIdentifier = "reminder"
            content.userInfo = ["kind": r.kind.rawValue, "baby": r.baby?.uuidString ?? ""]
            // first stage is silent (the watch taps the wrist); the escalation plays a sound
            content.sound = r.escalated ? .defaultCritical : nil
            content.interruptionLevel = r.escalated ? .timeSensitive : .active
            let interval = max(1, r.fireAt.timeIntervalSinceNow)
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            center.add(UNNotificationRequest(identifier: "\(r.kind.rawValue)-\(r.baby?.uuidString ?? "")-\(r.escalated)", content: content, trigger: trigger))
        }
    }
}

final class NotificationHandler: NSObject, UNUserNotificationCenterDelegate, @unchecked Sendable {
    weak var model: AppModel?

    init(model: AppModel) {
        self.model = model
        super.init()
        ReminderScheduler.registerCategories()
        UNUserNotificationCenter.current().delegate = self
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        let kindRaw = info["kind"] as? String ?? "feed"
        let babyStr = info["baby"] as? String ?? ""
        let action = response.actionIdentifier
        Task { @MainActor [weak model] in
            guard let model else { return }
            let kind = PlannedReminder.Kind(rawValue: kindRaw) ?? .feed
            switch action {
            case "SNOOZE_15": model.snoozeReminder(kind, minutes: 15)
            case "SNOOZE_30": model.snoozeReminder(kind, minutes: 30)
            case "START_FEED":
                let babies = UUID(uuidString: babyStr).map { [$0] }
                model.log(model.household.defaultFeed == "breast" ? "feed.breast.start" : "feed.bottle.start", for: babies)
            default: break
            }
        }
        completionHandler()
    }
}

// MARK: - Live Activity for open sessions

@MainActor
enum SessionActivities {
    /// One Live Activity per child with an open feed or sleep; `named` shows the child's name.
    static func sync(_ children: [(Baby, StatusSnapshot)], named: Bool) {
        #if canImport(ActivityKit)
        let enabled = UserDefaults.standard.object(forKey: "liveActivitiesEnabled") as? Bool ?? true
        guard enabled, ActivityAuthorizationInfo().areActivitiesEnabled else {
            endAll()
            return
        }
        var current = Activity<SessionActivityAttributes>.activities
        for (baby, status) in children {
            let kind: String? = status.sleepingSince != nil ? "sleep" : status.openFeedKind
            let since = status.sleepingSince ?? status.openFeedSince
            // activities from before children had ids belong to the first child
            let mine = current.filter { $0.attributes.babyId == baby.id.uuidString || ($0.attributes.babyId == nil && baby.id == children.first?.0.id) }
            current.removeAll { a in mine.contains { $0.id == a.id } }
            guard let kind, let since else {
                for a in mine { Task { await a.end(nil, dismissalPolicy: .immediate) } }
                continue
            }
            let state = SessionActivityAttributes.ContentState(kind: kind, since: since, side: status.nextSide, statusLine: status.line(now: Date()))
            if let a = mine.first(where: { $0.attributes.babyId != nil }) {
                Task { await a.update(ActivityContent(state: state, staleDate: nil)) }
                for old in mine where old.id != a.id { Task { await old.end(nil, dismissalPolicy: .immediate) } }
            } else {
                for old in mine { Task { await old.end(nil, dismissalPolicy: .immediate) } }
                _ = try? Activity.request(attributes: SessionActivityAttributes(babyName: named ? baby.name : "", babyId: baby.id.uuidString),
                                          content: ActivityContent(state: state, staleDate: nil))
            }
        }
        for a in current { Task { await a.end(nil, dismissalPolicy: .immediate) } }   // hidden or archived children
        #endif
    }

    /// End all ongoing session live activities immediately.
    static func endAll() {
        #if canImport(ActivityKit)
        for a in Activity<SessionActivityAttributes>.activities {
            Task { await a.end(nil, dismissalPolicy: .immediate) }
        }
        #endif
    }
}
