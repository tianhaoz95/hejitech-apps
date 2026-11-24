import CloudKit
import Foundation

public enum CloudSyncStatus: Equatable, Sendable {
    case disabled
    case idle
    case syncing
    case accountUnavailable(String)
    case error(String)

    public var displayText: String {
        switch self {
        case .disabled: return "Off"
        case .idle: return "Up to Date"
        case .syncing: return "Syncing…"
        case .accountUnavailable(let reason): return reason
        case .error(let message): return "Error: \(message)"
        }
    }
}

/// Pure serialization & conflict-resolution logic for iCloud Sync, separated from `CKSyncEngine`
/// so it can be unit-tested deterministically without a live Apple Account.
public enum CloudSyncCodec {
    public static let zoneID = CKRecordZone.ID(zoneName: "VoxbriefZone", ownerName: CKCurrentUserDefaultName)

    public enum RecordKind: String, Sendable {
        case note = "VoiceNote"
        case dictionary = "DictionaryEntry"
        case template = "NoteTemplate"

        var prefix: String {
            switch self {
            case .note: return "note-"
            case .dictionary: return "dict-"
            case .template: return "tmpl-"
            }
        }
    }

    public static func recordName(kind: RecordKind, id: UUID) -> String {
        "\(kind.prefix)\(id.uuidString)"
    }

    public static func parseRecordName(_ name: String) -> (kind: RecordKind, id: UUID)? {
        for kind in [RecordKind.note, .dictionary, .template] {
            if name.hasPrefix(kind.prefix),
               let uuid = UUID(uuidString: String(name.dropFirst(kind.prefix.count))) {
                return (kind, uuid)
            }
        }
        return nil
    }

    public static func recordID(kind: RecordKind, id: UUID) -> CKRecord.ID {
        CKRecord.ID(recordName: recordName(kind: kind, id: id), zoneID: zoneID)
    }

    public static func parseRecordID(_ recordID: CKRecord.ID) -> (kind: RecordKind, id: UUID)? {
        parseRecordName(recordID.recordName)
    }

    private static var encoder: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }

    private static var decoder: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    public static func encodePayload<T: Encodable>(_ value: T) throws -> Data {
        try encoder.encode(value)
    }

    public static func decodePayload<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        try decoder.decode(type, from: data)
    }

    public static func makeRecord(for note: VoiceNote, audioURL: URL? = nil) throws -> CKRecord {
        let record = CKRecord(recordType: RecordKind.note.rawValue, recordID: recordID(kind: .note, id: note.id))
        record["payload"] = try encodePayload(note) as NSData
        record["modifiedAt"] = note.modifiedAt as NSDate
        if let audioURL, FileManager.default.fileExists(atPath: audioURL.path) {
            record["audioAsset"] = CKAsset(fileURL: audioURL)
        }
        return record
    }

    public static func decodeNote(from record: CKRecord) throws -> (note: VoiceNote, audioAssetURL: URL?) {
        guard let data = record["payload"] as? Data else {
            throw NSError(domain: "CloudSyncCodec", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing note payload."])
        }
        let note = try decodePayload(VoiceNote.self, from: data)
        let assetURL = (record["audioAsset"] as? CKAsset)?.fileURL
        return (note, assetURL)
    }

    public static func makeRecord(for entry: DictionaryEntry) throws -> CKRecord {
        let record = CKRecord(recordType: RecordKind.dictionary.rawValue, recordID: recordID(kind: .dictionary, id: entry.id))
        record["payload"] = try encodePayload(entry) as NSData
        record["modifiedAt"] = Date() as NSDate
        return record
    }

    public static func decodeDictionaryEntry(from record: CKRecord) throws -> DictionaryEntry {
        guard let data = record["payload"] as? Data else {
            throw NSError(domain: "CloudSyncCodec", code: 2, userInfo: [NSLocalizedDescriptionKey: "Missing dictionary payload."])
        }
        return try decodePayload(DictionaryEntry.self, from: data)
    }

    public static func makeRecord(for template: NoteTemplate) throws -> CKRecord {
        let record = CKRecord(recordType: RecordKind.template.rawValue, recordID: recordID(kind: .template, id: template.id))
        record["payload"] = try encodePayload(template) as NSData
        record["modifiedAt"] = Date() as NSDate
        return record
    }

    public static func decodeTemplate(from record: CKRecord) throws -> NoteTemplate {
        guard let data = record["payload"] as? Data else {
            throw NSError(domain: "CloudSyncCodec", code: 3, userInfo: [NSLocalizedDescriptionKey: "Missing template payload."])
        }
        return try decodePayload(NoteTemplate.self, from: data)
    }

    /// Resolves a conflict between a local and remote copy of the same `VoiceNote`.
    /// Never lets an in-progress draft clobber a `.ready` note; otherwise picks the newer
    /// `modifiedAt` and unions completed action items so checklist progress isn't lost.
    public static func resolveConflict(local: VoiceNote, remote: VoiceNote) -> VoiceNote {
        if local.status == .ready && remote.status != .ready {
            return local
        }
        if remote.status == .ready && local.status != .ready {
            return remote
        }
        var winner = remote.modifiedAt >= local.modifiedAt ? remote : local
        let loser = remote.modifiedAt >= local.modifiedAt ? local : remote
        let mergedCompleted = Array(Set(winner.completedActionItems).union(loser.completedActionItems))
        winner.completedActionItems = mergedCompleted
        return winner
    }
}

/// Opt-in private iCloud sync between iPhone and Mac using `CKSyncEngine` (iOS 17+ / macOS 14+).
/// Syncs `VoiceNote` records, `PersonalDictionaryStore` entries, and custom `TemplateStore`
/// templates through the user's private CloudKit database — zero backend, end-to-end private.
@MainActor
public final class CloudSyncService: ObservableObject {
    public static let shared = CloudSyncService()

    public static let containerIdentifier = "iCloud.com.jacksonzhou666.voxbrief"
    public static let enabledKey = "voxbrief_icloud_sync_enabled"
    public static let syncAudioKey = "voxbrief_icloud_sync_audio"
    public static let lastSyncedKey = "voxbrief_icloud_last_synced"

    @Published public var isEnabled: Bool {
        didSet {
            defaults.set(isEnabled, forKey: Self.enabledKey)
            if isEnabled {
                Task { await startEngine() }
            } else {
                stopEngine()
            }
        }
    }

    @Published public var syncAudioFiles: Bool {
        didSet {
            defaults.set(syncAudioFiles, forKey: Self.syncAudioKey)
        }
    }

    @Published public private(set) var status: CloudSyncStatus = .disabled
    @Published public private(set) var lastSyncedAt: Date?

    private let defaults: UserDefaults
    private let stateFileURL: URL
    private var syncEngine: CKSyncEngine?
    private var delegateProxy: SyncEngineDelegateProxy?

    private weak var repository: NoteRepository?
    private var audioFileManager: AudioFileManager?
    private weak var dictionaryStore: PersonalDictionaryStore?
    private weak var templateStore: TemplateStore?

    public init(defaults: UserDefaults = .standard, stateFileURL: URL? = nil) {
        self.defaults = defaults
        if let stateFileURL {
            self.stateFileURL = stateFileURL
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
            self.stateFileURL = appSupport.appendingPathComponent("cloud_sync_state.data")
        }
        self.isEnabled = defaults.bool(forKey: Self.enabledKey)
        self.syncAudioFiles = defaults.bool(forKey: Self.syncAudioKey)
        if let ts = defaults.object(forKey: Self.lastSyncedKey) as? Double {
            self.lastSyncedAt = Date(timeIntervalSince1970: ts)
        }
        self.status = isEnabled ? .idle : .disabled
    }

    /// Connects the sync service to the live stores for this app (iOS or Mac) and starts the
    /// engine if the user previously enabled iCloud sync.
    public func attach(
        repository: NoteRepository,
        audioFileManager: AudioFileManager,
        dictionaryStore: PersonalDictionaryStore,
        templateStore: TemplateStore
    ) {
        self.repository = repository
        self.audioFileManager = audioFileManager
        self.dictionaryStore = dictionaryStore
        self.templateStore = templateStore

        repository.onNoteSaved = { [weak self] note in
            self?.enqueueSave(kind: .note, id: note.id)
        }
        repository.onNoteDeleted = { [weak self] id in
            self?.enqueueDelete(kind: .note, id: id)
        }
        dictionaryStore.onEntrySaved = { [weak self] entry in
            self?.enqueueSave(kind: .dictionary, id: entry.id)
        }
        dictionaryStore.onEntryDeleted = { [weak self] id in
            self?.enqueueDelete(kind: .dictionary, id: id)
        }
        templateStore.onTemplateSaved = { [weak self] template in
            self?.enqueueSave(kind: .template, id: template.id)
        }
        templateStore.onTemplateDeleted = { [weak self] id in
            self?.enqueueDelete(kind: .template, id: id)
        }

        if isEnabled {
            Task { await startEngine() }
        }
    }

    /// Manually triggers a fetch + send pass.
    public func syncNow() {
        guard isEnabled else { return }
        Task {
            if syncEngine == nil {
                await startEngine()
            }
            guard let engine = syncEngine else { return }
            status = .syncing
            do {
                try await engine.fetchChanges()
                try await engine.sendChanges()
                markSynced()
            } catch {
                status = .error(error.localizedDescription)
            }
        }
    }

    // MARK: - Engine Lifecycle

    private func startEngine() async {
        guard isEnabled else { return }
        status = .syncing

        let container = CKContainer(identifier: Self.containerIdentifier)
        do {
            let accountStatus = try await container.accountStatus()
            guard accountStatus == .available else {
                status = .accountUnavailable(Self.accountStatusMessage(accountStatus))
                return
            }
        } catch {
            status = .accountUnavailable("iCloud unavailable: \(error.localizedDescription)")
            return
        }

        let proxy = SyncEngineDelegateProxy(service: self)
        self.delegateProxy = proxy
        let savedState = loadStateSerialization()
        let config = CKSyncEngine.Configuration(
            database: container.privateCloudDatabase,
            stateSerialization: savedState,
            delegate: proxy
        )
        let engine = CKSyncEngine(config)
        self.syncEngine = engine

        // Ensure our custom zone exists and enqueue any existing local records on first sync.
        engine.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: CloudSyncCodec.zoneID))])
        if savedState == nil {
            enqueueAllLocalRecords()
        }

        do {
            try await engine.fetchChanges()
            try await engine.sendChanges()
            markSynced()
        } catch {
            status = .error(error.localizedDescription)
        }
    }

    private func stopEngine() {
        syncEngine = nil
        delegateProxy = nil
        status = .disabled
    }

    private func enqueueAllLocalRecords() {
        guard let engine = syncEngine else { return }
        var changes: [CKSyncEngine.PendingRecordZoneChange] = []
        if let notes = repository?.notes {
            for note in notes where note.status == .ready {
                changes.append(.saveRecord(CloudSyncCodec.recordID(kind: .note, id: note.id)))
            }
        }
        if let entries = dictionaryStore?.entries {
            for entry in entries {
                changes.append(.saveRecord(CloudSyncCodec.recordID(kind: .dictionary, id: entry.id)))
            }
        }
        if let templates = templateStore?.customTemplates {
            for template in templates {
                changes.append(.saveRecord(CloudSyncCodec.recordID(kind: .template, id: template.id)))
            }
        }
        if !changes.isEmpty {
            engine.state.add(pendingRecordZoneChanges: changes)
        }
    }

    private func enqueueSave(kind: CloudSyncCodec.RecordKind, id: UUID) {
        guard isEnabled, let engine = syncEngine else { return }
        engine.state.add(pendingRecordZoneChanges: [.saveRecord(CloudSyncCodec.recordID(kind: kind, id: id))])
    }

    private func enqueueDelete(kind: CloudSyncCodec.RecordKind, id: UUID) {
        guard isEnabled, let engine = syncEngine else { return }
        engine.state.add(pendingRecordZoneChanges: [.deleteRecord(CloudSyncCodec.recordID(kind: kind, id: id))])
    }

    private func markSynced() {
        let now = Date()
        lastSyncedAt = now
        defaults.set(now.timeIntervalSince1970, forKey: Self.lastSyncedKey)
        status = .idle
    }

    // MARK: - CKSyncEngine Event Handling

    fileprivate func handleEvent(_ event: CKSyncEngine.Event) {
        switch event {
        case .stateUpdate(let update):
            saveStateSerialization(update.stateSerialization)

        case .accountChange(let change):
            switch change.changeType {
            case .signOut, .switchAccounts:
                try? FileManager.default.removeItem(at: stateFileURL)
                status = .accountUnavailable("Signed out of iCloud")
            case .signIn:
                enqueueAllLocalRecords()
                status = .idle
            @unknown default:
                break
            }

        case .fetchedRecordZoneChanges(let fetched):
            for modification in fetched.modifications {
                applyFetchedRecord(modification.record)
            }
            for deletion in fetched.deletions {
                applyFetchedDeletion(deletion.recordID)
            }
            markSynced()

        case .sentRecordZoneChanges(let sent):
            for failedSave in sent.failedRecordSaves {
                if failedSave.error.code == .serverRecordChanged,
                   let serverRecord = failedSave.error.serverRecord {
                    applyFetchedRecord(serverRecord)
                }
            }
            if sent.failedRecordSaves.isEmpty {
                markSynced()
            }

        case .willFetchChanges, .willSendChanges:
            status = .syncing

        case .didFetchChanges, .didSendChanges:
            if case .syncing = status {
                markSynced()
            }

        default:
            break
        }
    }

    fileprivate func nextRecordZoneChangeBatch(_ context: CKSyncEngine.SendChangesContext, engine: CKSyncEngine) async -> CKSyncEngine.RecordZoneChangeBatch? {
        let scope = context.options.scope
        let changes = engine.state.pendingRecordZoneChanges.filter { scope.contains($0) }
        guard !changes.isEmpty else { return nil }

        return await CKSyncEngine.RecordZoneChangeBatch(pendingChanges: changes) { [weak self] recordID in
            guard let self else { return nil }
            return await MainActor.run {
                self.buildRecord(for: recordID)
            }
        }
    }

    private func buildRecord(for recordID: CKRecord.ID) -> CKRecord? {
        guard let parsed = CloudSyncCodec.parseRecordID(recordID) else { return nil }
        switch parsed.kind {
        case .note:
            guard let note = repository?.note(withId: parsed.id), note.status == .ready else { return nil }
            let audioURL: URL? = {
                guard syncAudioFiles, let fileName = note.audioFileName, let fm = audioFileManager else { return nil }
                return fm.url(for: fileName)
            }()
            return try? CloudSyncCodec.makeRecord(for: note, audioURL: audioURL)
        case .dictionary:
            guard let entry = dictionaryStore?.entries.first(where: { $0.id == parsed.id }) else { return nil }
            return try? CloudSyncCodec.makeRecord(for: entry)
        case .template:
            guard let template = templateStore?.customTemplates.first(where: { $0.id == parsed.id }) else { return nil }
            return try? CloudSyncCodec.makeRecord(for: template)
        }
    }

    private func applyFetchedRecord(_ record: CKRecord) {
        guard let parsed = CloudSyncCodec.parseRecordID(record.recordID) else { return }
        switch parsed.kind {
        case .note:
            guard let decoded = try? CloudSyncCodec.decodeNote(from: record), let repository else { return }
            if let assetURL = decoded.audioAssetURL,
               let fileName = decoded.note.audioFileName,
               let audioFileManager {
                let destination = audioFileManager.url(for: fileName)
                if !FileManager.default.fileExists(atPath: destination.path) {
                    try? FileManager.default.copyItem(at: assetURL, to: destination)
                }
            }
            if let existing = repository.note(withId: decoded.note.id) {
                let merged = CloudSyncCodec.resolveConflict(local: existing, remote: decoded.note)
                repository.applyRemoteNote(merged)
            } else {
                repository.applyRemoteNote(decoded.note)
            }
        case .dictionary:
            guard let entry = try? CloudSyncCodec.decodeDictionaryEntry(from: record) else { return }
            dictionaryStore?.applyRemoteEntry(entry)
        case .template:
            guard let template = try? CloudSyncCodec.decodeTemplate(from: record) else { return }
            templateStore?.applyRemoteTemplate(template)
        }
    }

    private func applyFetchedDeletion(_ recordID: CKRecord.ID) {
        guard let parsed = CloudSyncCodec.parseRecordID(recordID) else { return }
        switch parsed.kind {
        case .note:
            repository?.removeRemoteNote(id: parsed.id)
        case .dictionary:
            dictionaryStore?.removeRemoteEntry(id: parsed.id)
        case .template:
            templateStore?.removeRemoteTemplate(id: parsed.id)
        }
    }

    // MARK: - State Persistence

    private func loadStateSerialization() -> CKSyncEngine.State.Serialization? {
        guard let data = try? Data(contentsOf: stateFileURL) else { return nil }
        return try? JSONDecoder().decode(CKSyncEngine.State.Serialization.self, from: data)
    }

    private func saveStateSerialization(_ serialization: CKSyncEngine.State.Serialization) {
        if let data = try? JSONEncoder().encode(serialization) {
            try? data.write(to: stateFileURL, options: .atomic)
        }
    }

    private static func accountStatusMessage(_ status: CKAccountStatus) -> String {
        switch status {
        case .noAccount: return "Sign in to iCloud in Settings"
        case .restricted: return "iCloud account is restricted"
        case .temporarilyUnavailable: return "iCloud temporarily unavailable"
        case .couldNotDetermine: return "Could not verify iCloud account"
        case .available: return "Available"
        @unknown default: return "iCloud unavailable"
        }
    }
}

private final class SyncEngineDelegateProxy: NSObject, CKSyncEngineDelegate, @unchecked Sendable {
    weak var service: CloudSyncService?

    init(service: CloudSyncService) {
        self.service = service
    }

    func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        await service?.handleEvent(event)
    }

    func nextRecordZoneChangeBatch(_ context: CKSyncEngine.SendChangesContext, syncEngine: CKSyncEngine) async -> CKSyncEngine.RecordZoneChangeBatch? {
        await service?.nextRecordZoneChangeBatch(context, engine: syncEngine)
    }
}
