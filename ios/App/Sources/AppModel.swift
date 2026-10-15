import AuthenticationServices
import BackgroundTasks
import Foundation
import LayaRuntime
import LogCore
import StoreKit
import SwiftUI
import WatchConnectivity

/// App state and the actions every screen uses. All writes go through `LogService`.
@MainActor
final class AppModel: ObservableObject {
    enum Phase { case loading, signedOut, needsHousehold, ready }

    struct Toast: Identifiable, Equatable {
        let id = UUID()
        let text: String
        let undo: UUID?
    }

    @Published var phase: Phase = .loading
    @Published var household = Household()
    @Published var log = DerivedLog(events: [])
    @Published var status: StatusSnapshot?
    @Published var reviews: [Capture] = []
    @Published var entitlement: Entitlement?
    @Published var toast: Toast?
    @Published var reviewing: Capture?
    @Published var error: String?
    @Published var recording = false
    @Published var thinking = false
    @Published var lastSync: Date?
    @Published var syncError: String?
    @Published var tokens: [AccessToken] = []

    @AppStorage("backendURL") var backendURL = BackendConfig.local.url.absoluteString
    @AppStorage("anonKey") var anonKey = BackendConfig.local.anonKey
    @AppStorage("decisionBackend") var decisionBackendRaw = DecisionBackend.onDevice.rawValue
    @AppStorage("devServer") var devServer = "http://127.0.0.1:8089"

    let models = ModelManagerHolder.shared
    let billing = Billing()
    private let recorder = Recorder()
    private let transcriber = WhisperTranscriber()
    private var backend: SupabaseClient
    private(set) var service: LogService?
    private var watch: WatchBridge?

    var me: UUID? { backend.session?.userId }
    var decisionBackend: DecisionBackend {
        get { DecisionBackend(rawValue: decisionBackendRaw) ?? .keywords }
        set { decisionBackendRaw = newValue.rawValue; Task { await rebuildInterpreter() } }
    }
    var email: String? { backend.session?.email }

    init() {
        backend = SupabaseClient(config: BackendConfig.local)
        backend = makeBackend()
    }

    private func makeBackend() -> SupabaseClient {
        let config = BackendConfig(url: URL(string: backendURL) ?? BackendConfig.local.url, anonKey: anonKey)
        let session = Keychain.get("session").flatMap { try? LogCoding.decoder.decode(AuthSession.self, from: $0) }
        let client = SupabaseClient(config: config, session: session)
        client.onSessionChange = { s in Keychain.set(s.flatMap { try? LogCoding.encoder.encode($0) }, for: "session") }
        return client
    }

    // MARK: lifecycle

    /// Launch arguments for simulator automation and screenshots (ignored when absent):
    /// `-autoSignIn parent1@example.com -demoText "finished, drank half" -screen timeline`
    @Published var screen = UserDefaults.standard.string(forKey: "screen") ?? "home"

    func start() async {
        watch = WatchBridge(model: self)
        if backend.session == nil, let email = UserDefaults.standard.string(forKey: "autoSignIn") {
            _ = try? await backend.signIn(email: email, password: UserDefaults.standard.string(forKey: "autoPassword") ?? "newborn-dev")
        }
        if backend.session == nil { phase = .signedOut; return }
        if let h = SharedStore.household, SharedStore.me == backend.session?.userId {
            await enter(h)
            Task { await syncNow() }
            return
        }
        do {
            if let h = try await backend.myHousehold() {
                await enter(h)
                await syncNow()
            } else { phase = .needsHousehold }
        } catch {
            self.error = error.localizedDescription
            phase = .signedOut
        }
    }

    private func enter(_ h: Household) async {
        household = h
        SharedStore.household = h
        SharedStore.me = backend.session?.userId
        guard let me = backend.session?.userId else { return }
        do {
            let s = LogService(store: try SharedStore.store(), household: h, me: me,
                               interpreter: VoiceInterpreter(model: models.model(for: decisionBackend, devServer: devServer), calibration: .bundled),
                               transcriber: transcriber, backend: backend)
            service = s
            phase = .ready
            prewarmModels()
            await refresh()
            if let demo = UserDefaults.standard.string(forKey: "demoText") {
                try? await Task.sleep(for: .seconds(1))
                await handle(transcript: demo)
            }
            if !UserDefaults.standard.bool(forKey: "skipPermissions") { await ReminderScheduler.requestPermission() }
            await billing.load()
            entitlement = try? await backend.fetchEntitlement()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Load Whisper and Laya in the background at launch, so the first voice entry doesn't pay
    /// for the one-time Core ML compile and model load. Laya is freed on a memory warning and
    /// reloads on the next push-to-talk.
    private func prewarmModels() {
        Task(priority: .utility) { [transcriber, service] in
            await transcriber.warmUp()
            await service?.interpreter.model.warmUp()
        }
        guard memoryObserver == nil else { return }
        memoryObserver = NotificationCenter.default.addObserver(forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                if let laya = await self?.service?.interpreter.model as? LayaDecisionModel { await laya.unload() }
            }
        }
    }

    private var memoryObserver: NSObjectProtocol?

    func rebuildInterpreter() async {
        await service?.setInterpreter(VoiceInterpreter(model: models.model(for: decisionBackend, devServer: devServer), calibration: .bundled))
    }

    // MARK: auth & household

    func signIn(email: String, password: String, create: Bool) async {
        do {
            backend = makeBackend()
            _ = create ? try await backend.signUp(email: email, password: password) : try await backend.signIn(email: email, password: password)
            await start()
        } catch { self.error = error.localizedDescription }
    }

    func signInWithApple(_ result: Result<ASAuthorization, Error>) async {
        do {
            guard case .success(let auth) = result, let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let token = cred.identityToken.flatMap({ String(data: $0, encoding: .utf8) }) else {
                if case .failure(let e) = result { throw e }
                return
            }
            _ = try await backend.signIn(provider: "apple", idToken: token)
            await start()
        } catch { self.error = "Apple sign-in needs the hosted project configured: \(error.localizedDescription)" }
    }

    func signOut() {
        backend.signOut()
        SharedStore.household = nil
        service = nil
        phase = .signedOut
    }

    func createHousehold(_ h: Household, displayName: String) async {
        do {
            var h = h
            h.caregivers = [Caregiver(id: backend.session!.userId, name: displayName)]
            try await backend.createHousehold(h, displayName: displayName)
            if let saved = try await backend.myHousehold() { await enter(saved) }
        } catch { self.error = error.localizedDescription }
    }

    func join(code: String, displayName: String) async {
        do {
            try await backend.joinHousehold(code: code, displayName: displayName)
            if let saved = try await backend.myHousehold() { await enter(saved) }
        } catch { self.error = error.localizedDescription }
    }

    func invite() async -> String? {
        do { return try await backend.createInvite() } catch { self.error = error.localizedDescription; return nil }
    }

    func save(_ h: Household) async {
        household = h
        SharedStore.household = h
        await service?.setHousehold(h)
        await refresh()
        do { try await backend.saveSettings(h) } catch { self.error = error.localizedDescription }
    }

    func deleteAllData() async {
        do {
            try await backend.deleteHouseholdData()
            try service?.store.deleteAll()
            signOut()
        } catch { self.error = error.localizedDescription }
    }

    // MARK: reading

    func refresh() async {
        guard let service else { return }
        do {
            log = try await service.derived()
            let s = try await service.status()
            status = s
            reviews = try service.store.captures().filter { $0.status == .needsReview }.sorted { $0.capturedAt > $1.capturedAt }
            SharedStore.snapshot = s
            await SharedStore.publish(from: service)
            if let me { ReminderScheduler.apply(ReminderPlanner.plan(log: log, household: household, me: me, now: Date())) }
            if !UserDefaults.standard.bool(forKey: "skipPermissions") { SessionActivities.sync(status: s, babyName: household.babyName) }
            watch?.push(line: s.line(now: Date()), openFeed: s.openFeedKind, sleeping: s.sleepingSince != nil)
        } catch { self.error = error.localizedDescription }
    }

    func syncNow() async {
        guard let service else { return }
        do {
            try await service.sync()
            lastSync = Date()
            syncError = nil
        } catch {
            // offline is normal: the outbox keeps everything until the next sync
            syncError = error.localizedDescription
            print("[sync] \(error)")
        }
        await refresh()
    }

    // MARK: writing

    private func did(_ e: LogEvent?, undoable: Bool = true) async {
        guard let e else { return }
        toast = Toast(text: VoiceInterpreter.label(type: e.type, fields: e.fields), undo: undoable ? e.id : nil)
        await refresh()
        Task { await syncNow() }
    }

    func perform(_ body: @escaping (LogService) async throws -> LogEvent?) {
        guard let service else { return }
        Task {
            do { await did(try await body(service)) } catch { self.error = error.localizedDescription }
        }
    }

    func log(_ type: String, _ fields: [String: FieldValue] = [:], at: Date = Date()) {
        perform { try await $0.log(type: type, fields: fields, occurredAt: at, provenance: Provenance(surface: .phone, input: .tap)) }
    }

    func undo(_ id: UUID) {
        perform { try await $0.undo(id) }
        toast = nil
    }

    func edit(_ e: LogEvent, fields: [String: FieldValue], at: Date) {
        perform { try await $0.edit(e.id, fields: fields, occurredAt: at) }
    }

    func resolveDuplicate(_ flag: DuplicateFlag, merge: Bool) {
        perform { try await $0.resolveDuplicate(original: flag.original, duplicate: flag.duplicate, merge: merge) }
    }

    func setOnDuty(_ on: Bool) {
        perform { [me] in try await $0.setOnDuty(on ? me : nil) }
    }

    // MARK: voice

    func startVoice() {
        guard !recording else { return }
        do {
            try recorder.start()
            recording = true
            // load both models while the parent is still talking
            Task { await transcriber.warmUp() }
            Task { await service?.interpreter.model.warmUp() }
        } catch { self.error = "Microphone unavailable: \(error.localizedDescription)" }
    }

    func stopVoice() {
        guard recording else { return }
        recording = false
        let capturedAt = Date()
        guard let url = recorder.stop() else { return }
        thinking = true
        Task {
            defer { thinking = false }
            do {
                let text = try await transcriber.transcribe(fileURL: url)
                try? FileManager.default.removeItem(at: url)   // audio never leaves the phone
                await handle(transcript: text, capturedAt: capturedAt, surface: .phone)
            } catch { self.error = "Could not transcribe: \(error.localizedDescription)" }
        }
    }

    /// The same pipeline as speech, from typed text (simulator, accessibility, quiet rooms).
    func handle(transcript: String, capturedAt: Date = Date(), surface: Surface = .phone, attachTo: UUID? = nil) async {
        guard let service, !transcript.isEmpty else { return }
        do {
            thinking = true
            defer { thinking = false }
            let r = try await service.processVoice(transcript: transcript, surface: surface, capturedAt: capturedAt, attachTo: attachTo)
            if let e = r.committed {
                await did(e)
            } else {
                await refresh()
                reviewing = r.capture
            }
        } catch { self.error = error.localizedDescription }
    }

    func choose(_ capture: Capture, candidate: Int) {
        reviewing = nil
        perform { try await $0.resolveCapture(capture.id, candidate: candidate) }
    }

    func dismiss(_ capture: Capture) {
        reviewing = nil
        perform { try await $0.dismissCapture(capture.id) }
    }

    func transcribe(_ url: URL) async throws -> String {
        try await transcriber.transcribe(fileURL: url)
    }

    // MARK: agents (MCP)

    var mcpURL: String { "\(backendURL)/functions/v1/mcp" }

    func loadTokens() async {
        tokens = (try? await backend.accessTokens()) ?? []
    }

    func createToken(name: String, write: Bool) async -> String? {
        defer { Task { await loadTokens() } }
        do { return try await backend.createAccessToken(name: name, scope: write ? "write" : "read") } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func revoke(_ t: AccessToken) async {
        try? await backend.revokeAccessToken(t.id)
        await loadTokens()
    }

    // MARK: billing

    func buy(_ product: Product) async {
        do {
            if let (plan, expires) = try await billing.purchase(product) {
                try await backend.recordPurchase(plan: plan, expiresAt: expires)
                entitlement = try await backend.fetchEntitlement()
            }
        } catch { self.error = error.localizedDescription }
    }

    func buyDummy(_ plan: Plan) async {
        let days = DummyStore.plans.first { $0.plan == plan }?.days
        do {
            try await backend.recordPurchase(plan: plan, expiresAt: days.map { Date().addingTimeInterval(Double($0) * 86400) })
            entitlement = try await backend.fetchEntitlement()
            toast = Toast(text: "Purchased \(plan.rawValue) (dummy store)", undo: nil)
        } catch { self.error = error.localizedDescription }
    }

    func restorePurchases() async {
        if let (plan, expires) = await billing.restore() {
            try? await backend.recordPurchase(plan: plan, expiresAt: expires)
            entitlement = try? await backend.fetchEntitlement()
        }
    }

    func allows(_ feature: Entitlement.Feature) -> Bool {
        entitlement?.allows(feature, now: Date()) ?? true
    }

    func exportCSV() -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(household.babyName)-log.csv")
        do {
            try CSVExport.csv(log: log, household: household).write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch { return nil }
    }

    // MARK: background

    static let syncTask = "com.hejitech.weehours.sync"

    static func registerBackgroundTasks(_ model: AppModel) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: syncTask, using: nil) { task in
            Task { @MainActor in
                await model.syncNow()   // includes processing captures from the glasses
                task.setTaskCompleted(success: true)
                scheduleBackgroundSync()
            }
        }
    }

    static func scheduleBackgroundSync() {
        let r = BGAppRefreshTaskRequest(identifier: syncTask)
        r.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(r)
    }
}

// MARK: - Watch bridge (phone side)

/// The watch sends typed actions, or a recorded audio file; the phone runs the pipeline and
/// pushes the status line back as application context.
final class WatchBridge: NSObject, WCSessionDelegate, @unchecked Sendable {
    weak var model: AppModel?

    init(model: AppModel) {
        self.model = model
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func push(line: String, openFeed: String?, sleeping: Bool) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
        try? WCSession.default.updateApplicationContext(["line": line, "openFeed": openFeed ?? "", "sleeping": sleeping, "at": Date().timeIntervalSince1970])
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        Task { @MainActor in
            guard let model, let service = model.service else { replyHandler(["error": "Open the iPhone app"]); return }
            do {
                var e: LogEvent?
                switch message["action"] as? String {
                case "toggleFeed": e = try await service.toggleFeed(surface: .watch)
                case "toggleSleep": e = try await service.toggleSleep(surface: .watch)
                case "switchSide": e = try await service.switchSide(surface: .watch)
                case "diaper": e = try await service.log(type: "diaper", fields: ["kind": .string(message["kind"] as? String ?? "wet")], provenance: Provenance(surface: .watch, input: .tap))
                case "undo": if let id = (message["id"] as? String).flatMap(UUID.init) { e = try await service.undo(id, surface: .watch) }
                default: break
                }
                await model.refresh()
                Task { await model.syncNow() }
                replyHandler(["label": e.map { VoiceInterpreter.label(type: $0.type, fields: $0.fields) } ?? "", "id": e?.id.uuidString ?? "",
                              "line": model.status?.line(now: Date()) ?? ""])
            } catch {
                replyHandler(["error": error.localizedDescription])
            }
        }
    }

    func session(_ session: WCSession, didReceive file: WCSessionFile) {
        let capturedAt = (file.metadata?["capturedAt"] as? Double).map(Date.init(timeIntervalSince1970:)) ?? Date()
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent("watch-\(UUID().uuidString).wav")
        try? FileManager.default.moveItem(at: file.fileURL, to: dest)
        Task { @MainActor in
            guard let model else { return }
            do {
                let text = try await model.transcribe(dest)
                try? FileManager.default.removeItem(at: dest)
                await model.handle(transcript: text, capturedAt: capturedAt, surface: .watch)
            } catch { model.error = "Watch audio: \(error.localizedDescription)" }
        }
    }
}
