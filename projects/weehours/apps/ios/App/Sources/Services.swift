import AVFoundation
import Foundation
import LayaRuntime
import LogCore
import Security
import StoreKit
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

// MARK: - Voice recorder (16 kHz mono WAV, what Whisper wants)

final class Recorder: NSObject, @unchecked Sendable {
    private var recorder: AVAudioRecorder?
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
    }

    func stop() -> URL? {
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

actor WhisperTranscriber: Transcriber {
    private var pipe: WhisperKit?
    private var loading: Task<WhisperKit, Error>?
    let model: String

    init(model: String = "base.en") { self.model = model }

    func warmUp() async { _ = try? await loaded() }

    /// The Core ML model and tokenizer shipped in the app bundle (scripts/fetch-models.sh).
    static var bundledFolders: (model: URL, tokenizer: URL)? {
        guard let root = Bundle.main.url(forResource: "Models", withExtension: nil)?.appendingPathComponent("whisper") else { return nil }
        let model = root.appendingPathComponent("openai_whisper-base.en")
        let tokenizer = root.appendingPathComponent("tokenizer")
        guard FileManager.default.fileExists(atPath: model.appendingPathComponent("AudioEncoder.mlmodelc").path) else { return nil }
        return (model, tokenizer)
    }

    private func loaded() async throws -> WhisperKit {
        if let pipe { return pipe }
        if let loading { return try await loading.value }
        let model = self.model
        let config: WhisperKitConfig
        if let bundled = Self.bundledFolders {
            config = WhisperKitConfig(modelFolder: bundled.model.path, tokenizerFolder: bundled.tokenizer, verbose: false, download: false)
        } else {
            config = WhisperKitConfig(model: model, verbose: false)   // first use downloads from Hugging Face
        }
        let task = Task { try await WhisperKit(config) }
        loading = task
        defer { loading = nil }
        let p = try await task.value
        pipe = p
        return p
    }

    func transcribe(fileURL: URL) async throws -> String {
        let p = try await loaded()
        // Prompt with the closed vocabulary so "poopy" and "three quarters" come out right.
        let prompt = "bottle, breastfeeding, nursing, diaper, wet, dirty, poop, asleep, woke up, quarter, half, three quarters, left, right, switched sides"
        let options = DecodingOptions(language: "en", promptTokens: p.tokenizer?.encode(text: " " + prompt))
        let results = try await p.transcribe(audioPath: fileURL.path, decodeOptions: options)
        return results.map(\.text).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
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
    static let modelURL = URL(string: "https://huggingface.co/tianhaoz95/wee-hours-baby-activity/resolve/none/Laya-ft-Q8_0.gguf")!
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
    static func requestPermission() async {
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
            content.title = r.kind == .feed ? "Feed" : "Diaper"
            content.body = r.message
            content.categoryIdentifier = "reminder"
            // first stage is silent (the watch taps the wrist); the escalation plays a sound
            content.sound = r.escalated ? .defaultCritical : nil
            content.interruptionLevel = r.escalated ? .timeSensitive : .active
            let interval = max(1, r.fireAt.timeIntervalSinceNow)
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            center.add(UNNotificationRequest(identifier: "\(r.kind.rawValue)-\(r.baby?.uuidString ?? "")-\(r.escalated)", content: content, trigger: trigger))
        }
    }
}

// MARK: - Live Activity for open sessions

@MainActor
enum SessionActivities {
    /// One Live Activity per child with an open feed or sleep; `named` shows the child's name.
    static func sync(_ children: [(Baby, StatusSnapshot)], named: Bool) {
        #if canImport(ActivityKit)
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
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
}

// MARK: - Billing (StoreKit 2 against the local .storekit configuration)

@MainActor
final class Billing: ObservableObject {
    static let productIds = Plan.allCases.map(\.productId)
    @Published var products: [Product] = []
    @Published var purchasing = false

    func load() async {
        products = (try? await Product.products(for: Self.productIds))?.sorted { $0.price < $1.price } ?? []
    }

    func purchase(_ product: Product) async throws -> (Plan, Date?)? {
        purchasing = true
        defer { purchasing = false }
        let result = try await product.purchase()
        guard case .success(let verification) = result, case .verified(let tx) = verification else { return nil }
        await tx.finish()
        let plan = Plan.allCases.first { $0.productId == tx.productID } ?? .monthly
        return (plan, tx.expirationDate)
    }

    func restore() async -> (Plan, Date?)? {
        try? await AppStore.sync()
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, let plan = Plan.allCases.first(where: { $0.productId == tx.productID }) {
                return (plan, tx.expirationDate)
            }
        }
        return nil
    }
}
