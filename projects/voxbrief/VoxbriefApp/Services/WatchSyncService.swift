import Foundation
import UIKit
import WatchConnectivity
import Combine

@MainActor
public final class WatchSyncService: NSObject, ObservableObject {
    public static let shared = WatchSyncService()

    @Published public private(set) var isSupported: Bool = false
    @Published public private(set) var isPaired: Bool = false
    @Published public private(set) var isWatchAppInstalled: Bool = false
    @Published public private(set) var isReachable: Bool = false
    @Published public private(set) var lastSyncDate: Date?
    @Published public private(set) var receivedFilesCount: Int = 0
    @Published public private(set) var latestSyncMessage: String = "Ready"

    private let repository: NoteRepository
    private let audioFileManager: AudioFileManager
    private let pipeline: NoteProcessingPipeline
    private let sessionStore = WatchSessionStore.shared
    private var activeObserver: NSObjectProtocol?

    /// How long a recording's pieces wait for the watch's list of them before the note is built
    /// from whatever has arrived.
    static let incompleteSessionWait: TimeInterval = 6 * 3600

    /// Tracks the currently-running "ingest + process an incoming file" background task, if any,
    /// so its expiration handler and the normal completion path can't both try to end it.
    private var activeBackgroundTaskId: UIBackgroundTaskIdentifier = .invalid

    /// Ends the active background task assertion exactly once, however processing finished
    /// (completed normally, threw, or the OS called the expiration handler because time ran out).
    private func endActiveBackgroundTask() {
        guard activeBackgroundTaskId != .invalid else { return }
        UIApplication.shared.endBackgroundTask(activeBackgroundTaskId)
        activeBackgroundTaskId = .invalid
    }
    
    public init(
        repository: NoteRepository = .shared,
        audioFileManager: AudioFileManager = .shared,
        pipeline: NoteProcessingPipeline = .shared
    ) {
        self.repository = repository
        self.audioFileManager = audioFileManager
        self.pipeline = pipeline
        super.init()
        
        setupSession()
        activeObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in await self?.assembleWaitingSessions() }
        }
    }

    // MARK: - Watch recordings that arrive in pieces

    /// What to do with the pieces waiting for one recording.
    enum SessionStep: Equatable {
        /// Not everything is here yet.
        case wait
        /// Build the note for the recording.
        case assemble
        /// The note was already built and has its transcript: these pieces came too late to be
        /// part of it, so each becomes a note of its own rather than being lost.
        case adoptLatePieces
        /// Nothing left to do with this folder.
        case discard
    }

    nonisolated static func step(
        hasPieces: Bool,
        isComplete: Bool,
        hasManifest: Bool,
        alreadyAssembled: Bool,
        noteExists: Bool,
        noteHasTranscript: Bool,
        waited: TimeInterval
    ) -> SessionStep {
        if alreadyAssembled {
            guard noteExists else { return .discard }
            guard noteHasTranscript else { return .wait }
            return hasPieces ? .adoptLatePieces : .discard
        }
        guard hasPieces else { return hasManifest && isComplete ? .discard : .wait }
        if isComplete { return .assemble }
        return !hasManifest && waited >= incompleteSessionWait ? .assemble : .wait
    }

    /// Looks at every recording with pieces waiting and builds the notes that are ready. Runs
    /// when a piece or a list arrives and whenever the app comes to the front.
    public func assembleWaitingSessions() async {
        for sessionId in sessionStore.sessionIds() {
            await assembleIfReady(sessionId)
        }
    }

    private func assembleIfReady(_ sessionId: UUID) async {
        let pieces = sessionStore.pieces(for: sessionId)
        let note = repository.note(withId: sessionId)
        let waited = sessionStore.newestArrival(for: sessionId).map { Date().timeIntervalSince($0) } ?? 0
        let step = Self.step(
            hasPieces: !pieces.isEmpty,
            isComplete: sessionStore.isComplete(sessionId),
            hasManifest: sessionStore.manifest(for: sessionId) != nil,
            alreadyAssembled: sessionStore.isAssembled(sessionId),
            noteExists: note != nil,
            noteHasTranscript: !(note?.rawTranscript.isEmpty ?? true),
            waited: waited
        )

        switch step {
        case .wait:
            return
        case .discard:
            sessionStore.removeSession(sessionId)
        case .adoptLatePieces:
            let late = sessionStore.stagedPieces(for: sessionId)
            for piece in late {
                guard let fileName = try? audioFileManager.copyIncomingAudioFile(
                    from: sessionStore.url(for: piece, sessionId: sessionId),
                    noteId: piece.id
                ) else { continue }
                await ingest(noteId: piece.id, createdAt: piece.createdAt, duration: piece.duration, source: piece.source, audioFileName: fileName)
            }
            sessionStore.remove(pieces: late, sessionId: sessionId)
        case .assemble:
            guard let first = pieces.first else { return }
            sessionStore.markAssembled(sessionId)
            // The note takes the recording's id. Its audio file is written by the pipeline, which
            // joins the pieces before transcribing them.
            await ingest(
                noteId: sessionId,
                createdAt: first.createdAt,
                duration: pieces.reduce(0) { $0 + $1.duration },
                source: first.source,
                audioFileName: "\(sessionId.uuidString).\(AudioConstants.fileExtension)"
            )
        }
    }

    /// Saves the incoming note and runs it through the pipeline, holding a background task so a
    /// delivery that launched the app in the background has a real chance to finish.
    private func ingest(noteId: UUID, createdAt: Date, duration: TimeInterval, source: NoteSource, audioFileName: String) async {
        // The app may be launched into the background just to receive this file, with only
        // a short OS-granted execution window before suspension. Without this assertion,
        // Stage 1/2 processing (model load + inference) can easily exceed that window and
        // get killed mid-flight, leaving the note stuck at a non-terminal status forever --
        // this extends the window and gives processing a real chance to reach .ready/.failed.
        self.activeBackgroundTaskId = UIApplication.shared.beginBackgroundTask(withName: "IngestAndProcessVoiceNote") { [weak self] in
            guard let self = self else { return }
            if let currentNote = self.repository.note(withId: noteId), currentNote.status.isProcessing {
                self.repository.updateStatus(for: noteId, status: .failed, errorMessage: "Processing timed out while backgrounded. Tap Retry to process.")
            }
            self.endActiveBackgroundTask()
        }
        defer { self.endActiveBackgroundTask() }

        let note = VoiceNote(
            id: noteId,
            createdAt: createdAt,
            duration: duration,
            audioFileName: audioFileName,
            title: "Incoming Note...",
            summary: "Processing audio from \(source.displayName)...",
            rawTranscript: "",
            cleanedNote: "",
            requirements: [],
            conditions: [],
            actionItems: [],
            tags: [],
            status: .syncing,
            source: source
        )
        self.repository.save(note)
        self.receivedFilesCount += 1
        self.lastSyncDate = Date()
        self.latestSyncMessage = "Received voice note from \(source.displayName)"

        // Trigger the 2-Stage Pipeline (ASR + LLM)
        await self.pipeline.process(note: note)
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
    
    /// Requests connected watch to trigger an immediate background sync check
    public func pingWatch() {
        guard WCSession.default.isReachable else {
            latestSyncMessage = "Watch is not reachable right now."
            return
        }
        
        WCSession.default.sendMessage([SyncConstants.keyAction: SyncConstants.actionPing], replyHandler: { reply in
            Task { @MainActor in
                self.latestSyncMessage = "Watch responded: \(reply)"
            }
        }, errorHandler: { error in
            Task { @MainActor in
                self.latestSyncMessage = "Ping failed: \(error.localizedDescription)"
            }
        })
    }
}

// MARK: - WCSessionDelegate

extension WatchSyncService: WCSessionDelegate {
    public nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            self.isPaired = session.isPaired
            self.isWatchAppInstalled = session.isWatchAppInstalled
            self.isReachable = session.isReachable
            if let error = error {
                self.latestSyncMessage = "Activation error: \(error.localizedDescription)"
            } else {
                self.latestSyncMessage = "Connected (state: \(activationState.rawValue))"
            }
        }
    }
    
    public nonisolated func sessionDidBecomeInactive(_ session: WCSession) {
        Task { @MainActor in
            self.latestSyncMessage = "Session became inactive"
        }
    }
    
    public nonisolated func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate if deactivated (e.g. switching watches)
        WCSession.default.activate()
    }
    
    public nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
        }
    }
    
    /// Handles audio file transferred from Apple Watch in the background.
    ///
    /// `file.fileURL` points to a temporary location that WatchConnectivity deletes as soon as
    /// this method returns, so the copy to permanent storage must happen synchronously here --
    /// deferring it into a dispatched `Task` (as an earlier version of this did) loses the race
    /// and the source file is gone by the time the copy runs, silently dropping every transfer.
    public nonisolated func session(_ session: WCSession, didReceive file: WCSessionFile) {
        let metadata = file.metadata ?? [:]
        let payload = WatchSyncPayload.from(dictionary: metadata)
        let noteId = payload?.noteId ?? UUID()
        let createdAt = payload?.createdAt ?? Date()
        let duration = payload?.duration ?? 0
        let source = payload?.source ?? .watchApp

        do {
            // A piece of a longer recording waits with the others until the recording is whole.
            if let payload, let sessionId = payload.sessionId {
                try sessionStore.stagePiece(from: file.fileURL, payload: payload, sessionId: sessionId)
                Task { @MainActor in
                    self.lastSyncDate = Date()
                    self.latestSyncMessage = "Received part of a recording from \(source.displayName)"
                    await self.assembleIfReady(sessionId)
                }
                return
            }

            let persistentFileName = try self.audioFileManager.copyIncomingAudioFile(
                from: file.fileURL,
                noteId: noteId
            )

            Task { @MainActor in
                await self.ingest(noteId: noteId, createdAt: createdAt, duration: duration, source: source, audioFileName: persistentFileName)
            }
        } catch {
            print("[WatchSyncService] Error handling incoming file: \(error)")
            Task { @MainActor in
                self.latestSyncMessage = "File handling error: \(error.localizedDescription)"
            }
        }
    }
    
    /// Handles user info dictionary sync
    public nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        // The watch's list of the pieces in a finished recording.
        if let manifest = WatchSessionManifest.from(dictionary: userInfo) {
            try? sessionStore.saveManifest(manifest)
            Task { @MainActor in
                await self.assembleIfReady(manifest.sessionId)
            }
            return
        }
        Task { @MainActor in
            self.latestSyncMessage = "Received userInfo: \(userInfo.keys.joined(separator: ", "))"
        }
    }
    
    /// Handles live messages
    public nonisolated func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        Task { @MainActor in
            let action = message[SyncConstants.keyAction] as? String
            if action == SyncConstants.actionPing {
                replyHandler([SyncConstants.keyAction: SyncConstants.actionAck, "status": "iOS Ready"])
            } else {
                replyHandler(["status": "acknowledged"])
            }
        }
    }
}
