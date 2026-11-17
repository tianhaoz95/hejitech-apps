import Foundation
import WatchConnectivity
import Combine

@MainActor
public final class WatchSyncService: NSObject, ObservableObject {
    public static let shared = WatchSyncService()
    
    @Published public private(set) var isSupported: Bool = false
    @Published public private(set) var isReachable: Bool = false
    @Published public private(set) var pendingTransfersCount: Int = 0
    @Published public private(set) var lastSyncMessage: String = "Ready"
    
    private let storage = WatchStorage.shared
    
    public override init() {
        super.init()
        setupSession()
    }
    
    public func setupSession() {
        guard WCSession.isSupported() else {
            isSupported = false
            return
        }
        
        isSupported = true
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }
    
    private static let sentManifestsKey = "watch_sent_session_manifests"

    /// Tells the iPhone which pieces make up each recording that is over, so it can join them
    /// into one note. Sent once per recording; user info transfers are queued and delivered even
    /// if the iPhone is away right now.
    private func sendManifestsForFinishedSessions() {
        let defaults = UserDefaults.standard
        var sent = defaults.stringArray(forKey: Self.sentManifestsKey) ?? []
        let active = WatchAudioRecorder.shared.activeSessionId
        let manifests = Self.manifests(for: storage.notes, activeSessionId: active, alreadySent: Set(sent))
        guard !manifests.isEmpty else { return }
        for manifest in manifests {
            WCSession.default.transferUserInfo(manifest.dictionaryRepresentation)
            sent.append(manifest.sessionId.uuidString)
        }
        defaults.set(Array(sent.suffix(100)), forKey: Self.sentManifestsKey)
    }

    /// The recordings that are over (not the one in progress, nothing still being written) and
    /// have not been announced yet, each with its pieces in order.
    nonisolated static func manifests(for notes: [WatchLocalNote], activeSessionId: UUID?, alreadySent: Set<String>) -> [WatchSessionManifest] {
        var bySession: [UUID: [WatchLocalNote]] = [:]
        for note in notes {
            if let sessionId = note.sessionId { bySession[sessionId, default: []].append(note) }
        }
        return bySession.compactMap { sessionId, pieces in
            guard sessionId != activeSessionId,
                  !alreadySent.contains(sessionId.uuidString),
                  !pieces.contains(where: { $0.syncState == .recording }) else { return nil }
            let ordered = pieces.sorted { ($0.segmentIndex ?? 0, $0.createdAt) < ($1.segmentIndex ?? 0, $1.createdAt) }
            return WatchSessionManifest(sessionId: sessionId, pieceIds: ordered.map(\.id))
        }
        .sorted { $0.sessionId.uuidString < $1.sessionId.uuidString }
    }

    nonisolated static func shouldHoldTransfers(isRecording: Bool, policy: WatchTransferPolicy, charging: Bool) -> Bool {
        isRecording && policy == .afterRecording && !charging
    }

    /// Syncs all pending notes to iOS app via WCSession file transfers
    public func syncPendingNotes() {
        guard WCSession.isSupported() else { return }

        // Sending is the radio's work. While a recording runs, its finished pieces wait on the
        // watch until it stops, unless the watch is on its charger or the owner chose Right Away.
        if Self.shouldHoldTransfers(
            isRecording: WatchAudioRecorder.shared.isRecording,
            policy: WatchRecordingConfig.load().transferPolicy,
            charging: WatchBatteryLog.reading(event: "sync").charging
        ) {
            let waiting = storage.pendingNotes().count
            lastSyncMessage = waiting == 0 ? "Recording" : "Holding \(waiting) until recording stops"
            return
        }

        // Reconcile any in-flight transfers that were interrupted or ended without callback
        let activeTransfers = WCSession.default.outstandingFileTransfers
        var activeNoteIds = Set<UUID>()
        for transfer in activeTransfers {
            if let metadata = transfer.file.metadata,
               let payload = WatchSyncPayload.from(dictionary: metadata) {
                activeNoteIds.insert(payload.noteId)
            }
        }
        storage.reconcileInFlightTransfers(activeTransferNoteIds: activeNoteIds)
        storage.purgeOldSyncedRecordings()
        
        sendManifestsForFinishedSessions()

        let pending = storage.pendingNotes()
        guard !pending.isEmpty else {
            lastSyncMessage = "No pending notes to sync"
            return
        }
        
        lastSyncMessage = "Syncing \(pending.count) note(s)..."
        
        for note in pending {
            let fileURL = storage.fileURL(for: note.localFileName)
            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                storage.updateSyncState(for: note.id, state: .failed)
                continue
            }
            
            let payload = WatchSyncPayload(
                noteId: note.id,
                createdAt: note.createdAt,
                duration: note.duration,
                source: note.source,
                audioFileName: note.localFileName,
                sessionId: note.sessionId,
                segmentIndex: note.segmentIndex
            )
            
            // Initiate background file transfer
            let transfer = WCSession.default.transferFile(fileURL, metadata: payload.dictionaryRepresentation)
            storage.updateSyncState(for: note.id, state: .transferring)
            print("[WatchSyncService] Queued background file transfer for note \(note.id), transfer ID: \(transfer)")
        }
        
        pendingTransfersCount = WCSession.default.outstandingFileTransfers.count
    }
}

// MARK: - WCSessionDelegate

extension WatchSyncService: WCSessionDelegate {
    public nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            self.isReachable = session.isReachable
            if let error = error {
                self.lastSyncMessage = "Activation error: \(error.localizedDescription)"
            } else {
                self.lastSyncMessage = "WCSession Active"
                // Trigger auto sync on activation
                self.syncPendingNotes()
            }
        }
    }
    
    public nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
            if session.isReachable {
                self.syncPendingNotes()
            }
        }
    }
    
    /// Handles live messages from the iPhone, e.g. the "Ping Connected Watch" diagnostic in
    /// WatchSyncStatusView. Without this, `sendMessage(_:replyHandler:errorHandler:)` on the iOS
    /// side has nothing to deliver to on the watch and always fails with "payload could not be
    /// delivered" -- WCSessionDelegate's `didReceiveMessage` is optional, so a missing
    /// implementation compiles fine but silently drops every incoming message.
    public nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        let action = message[SyncConstants.keyAction] as? String
        if action == SyncConstants.actionPing {
            replyHandler([SyncConstants.keyAction: SyncConstants.actionAck, "status": "watchOS Ready"])
        } else {
            replyHandler(["status": "acknowledged"])
        }
    }

    public nonisolated func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
        let metadata = fileTransfer.file.metadata ?? [:]
        let payload = WatchSyncPayload.from(dictionary: metadata)
        
        Task { @MainActor in
            if let error = error {
                print("[WatchSyncService] File transfer failed: \(error)")
                if let id = payload?.noteId {
                    self.storage.updateSyncState(for: id, state: .failed)
                }
                self.lastSyncMessage = "Transfer failed: \(error.localizedDescription)"
            } else {
                print("[WatchSyncService] File transfer completed successfully!")
                if let id = payload?.noteId {
                    self.storage.updateSyncState(for: id, state: .synced)
                }
                self.lastSyncMessage = "Synced to iPhone"
            }
            self.pendingTransfersCount = WCSession.default.outstandingFileTransfers.count
        }
    }
}
