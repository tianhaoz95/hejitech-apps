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
        /// Undo takes back every entry logged together (one per child).
        var together = false
        /// A sentence kept as a note ("Log it") or a quick-capture guess ("Change"): reopens it.
        var reopen: Reopen? = nil
        struct Reopen: Equatable { let capture: UUID, events: [UUID], action: String }
    }

    @Published var phase: Phase = .loading
    @Published var household = Household() {
        didSet { normalizeTarget() }
    }
    /// The household's log (every child): Timeline, duplicates, duty.
    @Published var log = DerivedLog(events: [])
    /// Each shown child's log and status line.
    @Published var logs: [UUID: DerivedLog] = [:]
    @Published var statuses: [UUID: StatusSnapshot] = [:]
    /// The first shown child's status (single-child surfaces: watch, Live Activity fallback).
    @Published var status: StatusSnapshot?
    /// Who Now's quick actions log for (the Log-for bar); always shown children.
    @Published var target: [UUID] = [] {
        didSet { SharedStore.setLogFor(target) }
    }
    /// Children hidden on this phone (Settings → Children).
    @Published var hidden = SharedStore.hiddenChildren {
        didSet { SharedStore.hiddenChildren = hidden; normalizeTarget(); Task { await refresh() } }
    }
    /// The Log-for panel folded to one line, for a long stretch with one child.
    @AppStorage("logForCollapsed") var collapsed = false
    @Published var reviews: [Capture] = []
    @Published var entitlement: Entitlement?
    @Published var toast: Toast?
    @Published var reviewing: Capture?
    @Published var error: String?
    @Published var recording = false
    @Published var thinking = false
    @Published var liveTranscript = ""
    @Published var showingShiftDigest = false
    @Published var snoozedUntil: [PlannedReminder.Kind: Date] = [:]
    @Published var lastSync: Date?
    @Published var syncError: String?
    @Published var tokens: [AccessToken] = []

    @AppStorage("backendURL") var backendURL = BackendConfig.standard.url.absoluteString
    @AppStorage("anonKey") var anonKey = BackendConfig.standard.anonKey
    @AppStorage("decisionBackend") var decisionBackendRaw = DecisionBackend.onDevice.rawValue
    @AppStorage("devServer") var devServer = "http://127.0.0.1:8089"

    let models = ModelManagerHolder.shared
    let billing = Billing()
    private let recorder = Recorder()
    private let transcriber = WhisperTranscriber()
    private var backend: SupabaseClient
    private(set) var service: LogService?
    private var watch: WatchBridge?
    private var notifications: NotificationHandler?
    private var livePreviewTask: Task<Void, Never>?

    /// Local-only mode: the household lives on this phone with no account. Everything that only
    /// needs the phone works; signing in later uploads the log (`attachAccount`).
    @Published var localOnly = SharedStore.defaults.bool(forKey: "localOnly") {
        didSet { SharedStore.defaults.set(localOnly, forKey: "localOnly") }
    }

    /// A stable caregiver id for this phone while there is no account.
    var localUserId: UUID {
        if let s = SharedStore.defaults.string(forKey: "localUserId"), let id = UUID(uuidString: s) { return id }
        let id = UUID()
        SharedStore.defaults.set(id.uuidString, forKey: "localUserId")
        return id
    }

    var me: UUID? { localOnly ? localUserId : backend.session?.userId }
    var decisionBackend: DecisionBackend {
        get { DecisionBackend(rawValue: decisionBackendRaw) ?? .keywords }
        set { decisionBackendRaw = newValue.rawValue; Task { await rebuildInterpreter() } }
    }
    var email: String? { backend.session?.email }

    init() {
        Self.forgetSessionAfterReinstall()
        backend = SupabaseClient(config: BackendConfig.standard)
        backend = makeBackend()
    }

    /// The Keychain outlives the app, so a fresh install would otherwise pick up the previous
    /// install's session and land on household setup for an account the user never chose here.
    /// A fresh install has no launch marker and no cached household; updates keep their session.
    private static func forgetSessionAfterReinstall() {
        let marker = "launchedBefore"
        guard !UserDefaults.standard.bool(forKey: marker) else { return }
        UserDefaults.standard.set(true, forKey: marker)
        if SharedStore.household == nil, !SharedStore.defaults.bool(forKey: "localOnly") { Keychain.set(nil, for: "session") }
    }

    private func makeBackend() -> SupabaseClient {
        let config = BackendConfig(url: URL(string: backendURL) ?? BackendConfig.standard.url, anonKey: anonKey)
        let session = Keychain.get("session").flatMap { try? LogCoding.decoder.decode(AuthSession.self, from: $0) }
        let client = SupabaseClient(config: config, session: session)
        client.onSessionChange = { s in Keychain.set(s.flatMap { try? LogCoding.encoder.encode($0) }, for: "session") }
        return client
    }

    // MARK: lifecycle

    /// Launch arguments for simulator automation and screenshots (ignored when absent):
    /// `-autoSignIn parent1@example.com -demoText "finished, drank half" -screen timeline`
    @Published var screen = UserDefaults.standard.string(forKey: "screen") ?? "home"

    private var started = false

    /// Runs once per launch. It's called from a `.task`, which SwiftUI runs again whenever the root
    /// view reappears (for example after a full-screen modal like FeedbackKit's editor is dismissed).
    func start() async {
        guard !started else { return }
        started = true
        watch = WatchBridge(model: self)
        notifications = NotificationHandler(model: self)
        if backend.session == nil, let email = UserDefaults.standard.string(forKey: "autoSignIn") {
            _ = try? await backend.signIn(email: email, password: UserDefaults.standard.string(forKey: "autoPassword") ?? "newborn-dev")
        }
        if let names = UserDefaults.standard.string(forKey: "localSetup"), SharedStore.household == nil {
            localOnly = true   // automation: `-localSetup Mia` (or "Mia,Leo" for twins) sets up a local-only household
            let born = Date().addingTimeInterval(-21 * 86400)
            let babies = names.split(separator: ",").enumerated().map { Baby(name: String($1).trimmingCharacters(in: .whitespaces), birthDate: born, position: $0) }
            var h = Household(babies: babies)
            if let c = UserDefaults.standard.string(forKey: "categories") {   // `-categories all` or "bath,potty"
                h.categories = c == "all" ? EventRegistry.shared.categories.map(\.id) : c.split(separator: ",").map(String.init)
            }
            await createHousehold(h, displayName: "Alex")
            return
        }
        await route()
        if localOnly, let email = UserDefaults.standard.string(forKey: "attachAccount") {   // automation
            await attachAccount(email: email, password: "newborn-dev", create: true, inviteCode: nil)
        }
    }

    /// Picks the screen from the current session and household: at launch and after every sign-in.
    func route() async {
        if localOnly {
            if let h = SharedStore.household { await enter(h) } else { phase = .needsHousehold }
            return
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

    /// The children this phone shows on Now, in order.
    var shown: [Baby] {
        let list = household.active.filter { !hidden.contains($0.id) }
        return list.isEmpty ? household.active : list
    }

    var targetBabies: [Baby] { target.compactMap { household.baby($0) } }

    private func normalizeTarget() {
        let ids = shown.map(\.id)
        let kept = target.filter(ids.contains)
        let next = kept.isEmpty ? (SharedStore.logFor(household).filter(ids.contains).nilIfEmpty ?? Array(ids.prefix(1))) : kept
        if next != target { target = next }
    }

    /// Log for one child, or for every shown child.
    func setTarget(_ ids: [UUID]) { target = ids.isEmpty ? Array(shown.prefix(1).map(\.id)) : ids }

    private func enter(_ h: Household) async {
        household = h
        SharedStore.household = h
        SharedStore.me = me
        guard let me else { return }
        do {
            let s = LogService(store: try SharedStore.store(), household: h, me: me,
                               interpreter: VoiceInterpreter(model: models.model(for: decisionBackend, devServer: devServer), calibration: .bundled),
                               transcriber: transcriber, backend: localOnly ? nil : backend)
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
            entitlement = localOnly ? localEntitlement : ((try? await backend.fetchEntitlement()) ?? localEntitlement)
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Load Whisper and Laya in the background at launch, so the first voice entry doesn't pay
    /// for the one-time Core ML compile and model load. Laya is freed on a memory warning and
    /// reloads the next time the mic is tapped.
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
            await route()
        } catch { self.error = error.localizedDescription }
    }

    /// Where Supabase sends the browser back after Google sign-in (allow-listed in the shared project).
    static let authRedirect = "weehours://login-callback"

    /// Google through Supabase in the system browser sheet (PKCE), with the shared HEJI Google client.
    func signInWithGoogle(using session: WebAuthenticationSession) async {
        do {
            backend = makeBackend()
            let (url, verifier) = backend.oauthStart(provider: "google", redirect: Self.authRedirect)
            let callback = try await session.authenticate(using: url, callbackURLScheme: "weehours")
            let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
            guard let code = items.first(where: { $0.name == "code" })?.value else {
                let reason = items.first(where: { $0.name == "error_description" })?.value ?? "no code in the callback"
                throw BackendError.decode(reason.replacingOccurrences(of: "+", with: " "))
            }
            _ = try await backend.exchangeCode(code, verifier: verifier)
            await route()
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            return
        } catch { self.error = "Google sign-in failed: \(error.localizedDescription)" }
    }

    func signInWithApple(_ result: Result<ASAuthorization, Error>) async {
        do {
            guard case .success(let auth) = result, let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let token = cred.identityToken.flatMap({ String(data: $0, encoding: .utf8) }) else {
                if case .failure(let e) = result { throw e }
                return
            }
            _ = try await backend.signIn(provider: "apple", idToken: token)
            await route()
        } catch { self.error = "Apple sign-in needs the hosted project configured: \(error.localizedDescription)" }
    }

    func signOut() {
        backend.signOut()
        SharedStore.household = nil
        service = nil
        localOnly = false
        phase = .signedOut
    }

    /// "Use without an account": set up the household on this phone only.
    func useWithoutAccount() {
        localOnly = true
        phase = .needsHousehold
    }

    /// Trial and purchases while local-only (no server to record them).
    var localEntitlement: Entitlement {
        get {
            if let d = SharedStore.defaults.data(forKey: "entitlement"), let e = try? LogCoding.decoder.decode(Entitlement.self, from: d) { return e }
            let e = Entitlement(trialStartedAt: Date())
            SharedStore.defaults.set(try? LogCoding.encoder.encode(e), forKey: "entitlement")
            return e
        }
        set { SharedStore.defaults.set(try? LogCoding.encoder.encode(newValue), forKey: "entitlement") }
    }

    func createHousehold(_ h: Household, displayName: String) async {
        if localOnly {
            var h = h
            h.caregivers = [Caregiver(id: localUserId, name: displayName)]
            SharedStore.defaults.set(displayName, forKey: "displayName")
            _ = localEntitlement   // starts the trial
            await enter(h)
            return
        }
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

    /// Your own name, role and quiet hours, as the household sees them. The role and quiet hours
    /// travel with the household's settings; the name is your membership's (`set_display_name`).
    func saveProfile(name: String, role: String?, quietStart: Int? = nil, quietEnd: Int? = nil) async {
        guard let me, let i = household.caregivers.firstIndex(where: { $0.id == me }) else { return }
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedRole = role?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let role = trimmedRole.isEmpty ? nil : trimmedRole
        var h = household
        if !name.isEmpty { h.caregivers[i].name = name }
        h.caregivers[i].role = role
        h.caregivers[i].quietStart = quietStart
        h.caregivers[i].quietEnd = quietEnd
        guard h != household else { return }
        SharedStore.defaults.set(h.caregivers[i].name, forKey: "displayName")
        await save(h)
        guard !localOnly, !name.isEmpty else { return }
        do { try await backend.setDisplayName(name) } catch {
            syncError = "Your name is saved on this phone; it will reach the household when you're online."
        }
    }

    var activeSnoozeUntil: Date? { snoozedUntil.values.max() }

    func snoozeReminder(_ kind: PlannedReminder.Kind, minutes: Int) {
        snoozedUntil[kind] = Date().addingTimeInterval(TimeInterval(minutes * 60))
        toast = Toast(text: "Snoozed \(minutes)m", undo: nil)
        Task { await refresh() }
    }

    func snoozeReminders(minutes: Int) {
        if minutes <= 0 {
            snoozedUntil.removeAll()
            toast = Toast(text: "Reminders resumed", undo: nil)
        } else {
            let until = Date().addingTimeInterval(TimeInterval(minutes * 60))
            snoozedUntil[.feed] = until
            snoozedUntil[.diaper] = until
            toast = Toast(text: "Snoozed \(minutes)m", undo: nil)
        }
        Task { await refresh() }
    }

    var passBaseURL: String {
        backendURL.contains("127.0.0.1") || backendURL.contains("localhost") ? "http://127.0.0.1:8788" : "https://weehours.hejitech.workers.dev"
    }

    func createCaregiverPass(name: String, hours: Int, note: String) async -> String? {
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "|", with: " ")
        let cleanNote = note.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "|", with: " ")
        let expires = Int(Date().addingTimeInterval(Double(hours * 3600)).timeIntervalSince1970)
        let meta = "pass:\(cleanName.isEmpty ? "Caregiver" : cleanName)|\(expires)|\(cleanNote)"
        if localOnly {
            return "\(passBaseURL)/pass/wh_local_\(UUID().uuidString.prefix(8))"
        }
        defer { Task { await loadTokens() } }
        do {
            let token = try await backend.createAccessToken(name: meta, scope: "write")
            return "\(passBaseURL)/pass/\(token)"
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func invite() async -> String? {
        do { return try await backend.createInvite() } catch { self.error = error.localizedDescription; return nil }
    }

    /// Saved on the phone first; the server copy is retried on the next sync when offline.
    func save(_ h: Household) async {
        household = h
        SharedStore.household = h
        await service?.setHousehold(h)
        await refresh()
        guard !localOnly else { return }
        do {
            try await backend.saveSettings(h)
            SharedStore.defaults.set(false, forKey: "settingsPending")
        } catch {
            SharedStore.defaults.set(true, forKey: "settingsPending")
            syncError = "Settings saved on this phone; they'll sync when you're online."
        }
    }

    /// Sign in (or create an account) and move the local log into a household on the server:
    /// either a new household made from this one, or your partner's (with an invite code).
    /// Entries never left the phone, so they are re-homed before their first upload.
    func attachAccount(email: String, password: String, create: Bool, inviteCode: String?) async {
        guard localOnly, let service else { return }
        do {
            backend = makeBackend()
            let session = create ? try await backend.signUp(email: email, password: password) : try await backend.signIn(email: email, password: password)
            let name = SharedStore.defaults.string(forKey: "displayName") ?? "Parent"
            var target: Household
            if let code = inviteCode, !code.isEmpty {
                try await backend.joinHousehold(code: code, displayName: name)
                guard let joined = try await backend.myHousehold() else { throw SupabaseClientError.noHousehold }
                target = joined
            } else if let existing = try await backend.myHousehold() {
                target = existing      // this account already has a household: merge into it
            } else {
                var h = household
                h.caregivers = [Caregiver(id: session.userId, name: name)]
                try await backend.createHousehold(h, displayName: name)
                target = try await backend.myHousehold() ?? h
            }
            // children keep their ids in a household made from this one; joining another, they're matched by name
            let local = household.babies
            try service.store.rehome(household: target.id, baby: { id in
                if target.baby(id) != nil { return id }
                let name = local.first { $0.id == id }?.name.lowercased()
                return target.active.first { $0.name.lowercased() == name }?.id ?? target.babyId
            }, caregiver: (localUserId, session.userId))
            if let plan = localEntitlement.plan {
                try? await backend.recordPurchase(plan: plan, expiresAt: localEntitlement.expiresAt)
            }
            localOnly = false
            self.service = nil
            await enter(target)
            await syncNow()
            toast = Toast(text: "Signed in · your log is syncing", undo: nil)
        } catch { self.error = error.localizedDescription }
    }

    enum SupabaseClientError: Error, LocalizedError {
        case noHousehold
        var errorDescription: String? { "That invite didn't lead to a household." }
    }

    func deleteAllData() async {
        if localOnly {
            try? service?.store.deleteAll()
            SharedStore.household = nil
            service = nil
            localOnly = false
            phase = .signedOut
            return
        }
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
            let children = try await service.derivedByChild(shown)
            logs = Dictionary(uniqueKeysWithValues: children.map { ($0.0.id, $0.1) })
            var all: [UUID: StatusSnapshot] = [:]
            for b in shown { all[b.id] = try await service.status(baby: b.id) }
            statuses = all
            status = shown.first.flatMap { all[$0.id] }
            reviews = try service.store.captures().filter { $0.status == .needsReview }.sorted { $0.capturedAt > $1.capturedAt }
            await SharedStore.publish(from: service)
            if let me { ReminderScheduler.apply(ReminderPlanner.plan(logs: children, household: household, me: me, now: Date(), snoozedUntil: snoozedUntil)) }
            let named = shown.count > 1
            if !UserDefaults.standard.bool(forKey: "skipPermissions") {
                SessionActivities.sync(shown.compactMap { b in all[b.id].map { (b, $0) } }, named: named)
            }
            watch?.push(children: shown.compactMap { b in all[b.id].map { (b, $0) } }, target: target)
        } catch { self.error = error.localizedDescription }
    }

    func syncNow() async {
        guard let service, !localOnly else { await refresh(); return }
        if SharedStore.defaults.bool(forKey: "settingsPending"), (try? await backend.saveSettings(household)) != nil {
            SharedStore.defaults.set(false, forKey: "settingsPending")
        }
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

    /// "Diaper · wet", naming the children when the household has several ("… · Mia + Leo").
    func label(_ events: [LogEvent]) -> String {
        guard let e = events.first else { return "" }
        var text = VoiceInterpreter.label(type: e.type, fields: e.fields)
        if household.active.count > 1 {
            text += " · " + events.map { household.babyName($0.babyId) }.joined(separator: " + ")
        }
        return text
    }

    private func did(_ events: [LogEvent], undoable: Bool = true) async {
        guard let e = events.first else { return }
        toast = Toast(text: label(events), undo: undoable ? e.id : nil, together: events.count > 1)
        await refresh()
        Task { await syncNow() }
    }

    private func did(_ e: LogEvent?, undoable: Bool = true) async {
        await did(e.map { [$0] } ?? [], undoable: undoable)
    }

    func perform(_ body: @escaping (LogService) async throws -> LogEvent?) {
        guard let service else { return }
        Task {
            do { await did(try await body(service)) } catch { self.error = error.localizedDescription }
        }
    }

    /// Runs a quick action for each child in `babies` (default: the Log-for target), written
    /// together so one Undo takes them all back. Children it doesn't apply to return nil.
    func performEach(_ babies: [UUID]? = nil, _ body: @escaping @Sendable (isolated LogService, UUID, [String: FieldValue]) throws -> LogEvent?) {
        guard let service else { return }
        let ids = babies ?? target
        Task {
            do { await did(try await service.forEach(ids, body)) } catch { self.error = error.localizedDescription }
        }
    }

    /// Logs one entry for each child in `babies` (default: the Log-for target).
    func log(_ type: String, _ fields: [String: FieldValue] = [:], at: Date = Date(), for babies: [UUID]? = nil) {
        performEach(babies) { s, baby, group in
            try s.log(type: type, fields: fields.merging(group) { $1 }, occurredAt: at, provenance: Provenance(surface: .phone, input: .tap), baby: baby)
        }
    }

    func undo(_ id: UUID, together: Bool = false) {
        guard let service else { return }
        toast = nil
        Task {
            do {
                if together { try await service.undoGroup(of: id) } else { try await service.undo(id) }
                await refresh()
                Task { await syncNow() }
            } catch { self.error = error.localizedDescription }
        }
    }

    /// "Log it" (saved as a note) or "Change" (a quick-capture guess): back to the choices.
    func reopen(_ reopen: Toast.Reopen) {
        guard let service else { return }
        toast = nil
        Task {
            do {
                try await service.reopenCapture(reopen.capture, undoing: reopen.events)
                await refresh()
                reviewing = reviews.first { $0.id == reopen.capture }
            } catch { self.error = error.localizedDescription }
        }
    }

    /// A timed activity (tummy time, play, a walk) starts for each child in the Log-for target.
    func startTimed(_ type: String) {
        performEach { s, baby, group in try s.startTimed(type, baby: baby, fields: group) }
    }

    /// Stops running timed activities (one per child): each entry gets the minutes it ran.
    func stopTimed(_ events: [LogEvent]) {
        guard let service else { return }
        Task {
            do {
                var done: [LogEvent] = []
                for e in events { done.append(try await service.stopTimed(e.id)) }
                await did(done)
            } catch { self.error = error.localizedDescription }
        }
    }

    func edit(_ e: LogEvent, fields: [String: FieldValue], at: Date, baby: UUID? = nil) {
        perform { try await $0.edit(e.id, fields: fields, occurredAt: at, baby: baby) }
    }

    func resolveDuplicate(_ flag: DuplicateFlag, merge: Bool) {
        perform { try await $0.resolveDuplicate(original: flag.original, duplicate: flag.duplicate, merge: merge) }
    }

    func setOnDuty(_ on: Bool) {
        showingShiftDigest = true
        perform { [me] in try await $0.setOnDuty(on ? me : nil) }
    }

    // MARK: voice

    func startVoice() {
        guard !recording else { return }
        do {
            liveTranscript = ""
            try recorder.start()
            recording = true
            // load both models while the parent is still talking
            Task { await transcriber.warmUp() }
            Task { await service?.interpreter.model.warmUp() }
            livePreviewTask?.cancel()
            livePreviewTask = Task { [weak self, recorder, transcriber] in
                await transcriber.warmUp()
                while !Task.isCancelled {
                    try? await Task.sleep(for: .milliseconds(750))
                    guard !Task.isCancelled, let self, self.recording else { break }
                    let samples = recorder.samples()
                    guard samples.count >= 8_000 else { continue }
                    if let partial = try? await transcriber.transcribe(samples: samples), !partial.isEmpty, self.recording {
                        self.liveTranscript = partial
                    }
                }
            }
        } catch { self.error = "Microphone unavailable: \(error.localizedDescription)" }
    }

    func stopVoice() {
        guard recording else { return }
        recording = false
        livePreviewTask?.cancel()
        livePreviewTask = nil
        let capturedAt = Date()
        guard let url = recorder.stop() else { return }
        thinking = true
        Task {
            defer { thinking = false; liveTranscript = "" }
            do {
                let text = try await transcriber.transcribe(fileURL: url)
                try? FileManager.default.removeItem(at: url)   // audio never leaves the phone
                await handle(transcript: text, capturedAt: capturedAt, surface: .phone)
            } catch { self.error = "Could not transcribe: \(error.localizedDescription)" }
        }
    }

    /// Stops listening without logging anything (Cancel on the listening screen).
    func cancelVoice() {
        guard recording else { return }
        recording = false
        livePreviewTask?.cancel()
        livePreviewTask = nil
        liveTranscript = ""
        if let url = recorder.stop() { try? FileManager.default.removeItem(at: url) }
    }

    func voiceLevel() -> Float { recorder.level() }

    /// The voice pipeline from a transcript (phone and watch speech, or the `demoText` launch argument).
    func handle(transcript: String, capturedAt: Date = Date(), surface: Surface = .phone, attachTo: UUID? = nil, babies: [UUID]? = nil) async {
        guard let service, !transcript.isEmpty else { return }
        do {
            thinking = true
            defer { thinking = false }
            let quick = UserDefaults.standard.bool(forKey: QuickCapture.key)
            let r = try await service.processVoice(transcript: transcript, surface: surface, capturedAt: capturedAt, attachTo: attachTo,
                                                   babies: babies ?? target, quickCapture: quick)
            if r.capture.status == .dismissed, let note = r.events.first {
                toast = Toast(text: "Not a log entry: saved as a note", undo: nil, reopen: .init(capture: r.capture.id, events: [note.id], action: "Log it"))
                await refresh()
            } else if !r.events.isEmpty, r.interpretation.tier != .auto {
                // quick capture logged a guess: "Change" takes it back and shows the choices
                toast = Toast(text: label(r.events) + " · best guess", undo: nil,
                              reopen: .init(capture: r.capture.id, events: r.events.map(\.id), action: "Change"))
                await refresh()
                Task { await syncNow() }
            } else if !r.events.isEmpty {
                await did(r.events)
            } else {
                await refresh()
                reviewing = r.capture
            }
        } catch { self.error = error.localizedDescription }
    }

    func choose(_ capture: Capture, candidate: Int) {
        reviewing = nil
        guard let service else { return }
        Task {
            do { await did(try await service.resolveCapture(capture.id, candidate: candidate)) } catch { self.error = error.localizedDescription }
        }
    }

    func dismiss(_ capture: Capture) {
        reviewing = nil
        perform { try await $0.dismissCapture(capture.id) }
    }

    func transcribe(_ url: URL) async throws -> String {
        try await transcriber.transcribe(fileURL: url)
    }

    // MARK: agents (MCP)

    /// The website's Worker serves MCP (`services/web/src/worker`), not Supabase; locally `dev:worker`.
    var mcpURL: String {
        backendURL.contains("127.0.0.1") || backendURL.contains("localhost") ? "http://127.0.0.1:8788/mcp" : "https://weehours.hejitech.workers.dev/mcp"
    }

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

    /// Removes a revoked token from the list.
    func delete(_ t: AccessToken) async {
        do { try await backend.deleteAccessToken(t.id) } catch { self.error = error.localizedDescription }
        await loadTokens()
    }

    // MARK: billing

    func buy(_ product: Product) async {
        do {
            if let (plan, expires) = try await billing.purchase(product) {
                if localOnly {
                    var e = localEntitlement
                    e.plan = plan
                    e.expiresAt = expires
                    localEntitlement = e
                    entitlement = e
                    return
                }
                try await backend.recordPurchase(plan: plan, expiresAt: expires)
                entitlement = try await backend.fetchEntitlement()
            }
        } catch { self.error = error.localizedDescription }
    }

    func buyDummy(_ plan: Plan) async {
        let days = DummyStore.plans.first { $0.plan == plan }?.days
        if localOnly {
            var e = localEntitlement
            e.plan = plan
            e.expiresAt = days.map { Date().addingTimeInterval(Double($0) * 86400) }
            localEntitlement = e
            entitlement = e
            toast = Toast(text: "Purchased \(plan.rawValue) (dummy store)", undo: nil)
            return
        }
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
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(household.active.count > 1 ? household.name : household.babyName)-log.csv")
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

    /// Each shown child's line and state; `line`/`openFeed`/`sleeping` are the first child's, for
    /// watch builds from before several children. Also pushes running timed activities and top care trackers.
    @MainActor
    func push(children: [(Baby, StatusSnapshot)], target: [UUID]) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated, let first = children.first else { return }
        let now = Date()
        let list: [[String: Any]] = children.map { b, s in
            ["id": b.id.uuidString, "name": b.name, "line": s.line(now: now), "openFeed": s.openFeedKind ?? "", "sleeping": s.sleepingSince != nil]
        }
        var pinned: [[String: String]] = []
        if let model {
            let enabled = model.household.enabled
            for t in EventRegistry.shared.types where enabled.contains(t.category) && (t.isTimed || ["bath", "tummy_time", "teething"].contains(t.id)) {
                let running = model.log.effective.last { $0.type == t.id && $0.fields["ongoing"] == .bool(true) }
                pinned.append([
                    "id": t.id,
                    "label": running != nil ? "Stop \(t.label.lowercased())" : t.label,
                    "icon": t.icon ?? "circle.fill",
                    "runningId": running?.id.uuidString ?? "",
                ])
                if pinned.count >= 2 { break }
            }
        }
        try? WCSession.default.updateApplicationContext([
            "line": first.1.line(now: now), "openFeed": first.1.openFeedKind ?? "", "sleeping": first.1.sleepingSince != nil,
            "children": list, "target": target.count > 1 ? "all" : (target.first?.uuidString ?? ""),
            "pinned": pinned, "at": now.timeIntervalSince1970,
        ])
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        Task { @MainActor in
            guard let model, let service = model.service else { replyHandler(["error": "Open the iPhone app"]); return }
            do {
                let rawBaby = message["baby"] as? String
                let isAll = rawBaby == "all" && model.shown.count > 1
                let babies: [UUID] = isAll
                    ? model.shown.map(\.id)
                    : [(rawBaby.flatMap(UUID.init(uuidString:)).flatMap { id in model.shown.first { $0.id == id }?.id } ?? model.shown.first?.id).unsafelyUnwrapped]
                var events: [LogEvent] = []
                let extra: [String: FieldValue] = (message["fraction"] as? Double).map { ["consumed_fraction": .number($0)] } ?? [:]
                switch message["action"] as? String {
                case "toggleFeed":
                    events = try await service.forEach(babies) { s, b, g in
                        try s.toggleFeed(baby: b, surface: .watch, fields: extra.merging(g) { $1 })
                    }
                case "toggleSleep":
                    events = try await service.forEach(babies) { s, b, g in
                        try s.toggleSleep(baby: b, surface: .watch, fields: g)
                    }
                case "switchSide":
                    events = try await service.forEach(babies) { s, b, g in
                        try s.switchSide(baby: b, surface: .watch, fields: g)
                    }
                case "diaper":
                    let kind = message["kind"] as? String ?? "wet"
                    events = try await service.forEach(babies) { s, b, g in
                        try s.log(type: "diaper", fields: ["kind": .string(kind)].merging(g) { $1 }, provenance: Provenance(surface: .watch, input: .tap), baby: b)
                    }
                case "care":
                    if let runId = (message["runningId"] as? String).flatMap(UUID.init(uuidString:)) {
                        events = [try await service.stopTimed(runId, surface: .watch)]
                    } else if let type = message["type"] as? String {
                        let isTimed = EventRegistry.shared.type(type)?.isTimed ?? false
                        events = try await service.forEach(babies) { s, b, g in
                            isTimed ? try s.startTimed(type, baby: b, fields: g, surface: .watch)
                                    : try s.log(type: type, fields: g, provenance: Provenance(surface: .watch, input: .tap), baby: b)
                        }
                    }
                case "undo":
                    if let id = (message["id"] as? String).flatMap(UUID.init) {
                        events = try await service.undoGroup(of: id, surface: .watch)
                    }
                default: break
                }
                await model.refresh()
                Task { await model.syncNow() }
                let firstBaby = babies.first
                let line = isAll
                    ? model.shown.map { "\($0.name): \(model.statuses[$0.id]?.line(now: Date()).components(separatedBy: " · ").first ?? "")" }.joined(separator: " · ")
                    : (firstBaby.flatMap { model.statuses[$0] }?.line(now: Date()) ?? model.status?.line(now: Date()) ?? "")
                replyHandler(["label": events.isEmpty ? "" : model.label(events), "id": events.first?.id.uuidString ?? "", "line": line])
            } catch {
                replyHandler(["error": error.localizedDescription])
            }
        }
    }

    func session(_ session: WCSession, didReceive file: WCSessionFile) {
        let capturedAt = (file.metadata?["capturedAt"] as? Double).map(Date.init(timeIntervalSince1970:)) ?? Date()
        let baby = (file.metadata?["baby"] as? String).flatMap(UUID.init(uuidString:))
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent("watch-\(UUID().uuidString).wav")
        try? FileManager.default.moveItem(at: file.fileURL, to: dest)
        Task { @MainActor in
            guard let model else { return }
            do {
                let text = try await model.transcribe(dest)
                try? FileManager.default.removeItem(at: dest)
                await model.handle(transcript: text, capturedAt: capturedAt, surface: .watch, babies: baby.map { [$0] })
            } catch { model.error = "Watch audio: \(error.localizedDescription)" }
        }
    }
}

extension Array {
    var nilIfEmpty: Self? { isEmpty ? nil : self }
}

extension BackendConfig {
    /// Debug builds talk to the local stack; TestFlight and App Store builds to the hosted project.
    /// Settings → Server can still point either at another backend.
    static var standard: BackendConfig {
        #if DEBUG
        .local
        #else
        .production
        #endif
    }
}
