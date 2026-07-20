import ContempoCore
import FirebaseAuth
import FirebaseFirestore
import Foundation

public struct PendingAudioCapture: Sendable, Identifiable, Equatable {
    public let id: String
    public let storagePath: String
    public let capturedAt: Timestamp
    public let lat: Double?
    public let lng: Double?
    /// Defaults to `.auto` for captures with no explicit selection — currently
    /// every watch-relayed capture, since the language toggle only exists on
    /// the phone's Capture tab. See `CaptureLanguage`.
    public let language: CaptureLanguage

    public init(id: String, storagePath: String, capturedAt: Timestamp, lat: Double?, lng: Double?, language: CaptureLanguage = .auto) {
        self.id = id
        self.storagePath = storagePath
        self.capturedAt = capturedAt
        self.lat = lat
        self.lng = lng
        self.language = language
    }
}

/// Lightweight processing queue for audio recorded on a device that can't
/// transcribe/parse it itself (the watch) — a recording device uploads its
/// WAV to Firebase Storage, then writes one of these docs pointing at it; the
/// phone drains the queue, turning each into a real `Entry` and removing the
/// queue doc. The audio file in Storage is never deleted by this class — only
/// the queue bookkeeping is, once a capture has been durably turned into an
/// `Entry`.
///
/// Deliberately its own small type rather than a method on `EntryRepository`:
/// a queue entry isn't an `Entry` (no property/task/category yet), it's a
/// distinct, narrower concern. Same constructor shape as
/// `FirestoreEntryRepository` so both the phone and watch can build one the
/// same way.
public final class AudioCaptureQueue: @unchecked Sendable {
    private let firestore: Firestore
    private let auth: Auth

    public init(firestore: Firestore, auth: Auth) {
        self.firestore = firestore
        self.auth = auth
    }

    private var uid: String {
        guard let uid = auth.currentUser?.uid else {
            preconditionFailure("AudioCaptureQueue used before sign-in")
        }
        return uid
    }

    private func collection() -> CollectionReference {
        firestore.collection("users").document(uid).collection("audioCaptures")
    }

    @discardableResult
    public func enqueue(storagePath: String, capturedAt: Timestamp, lat: Double?, lng: Double?, language: CaptureLanguage = .auto) async throws -> String {
        var doc: [String: Any] = [
            "storagePath": storagePath,
            "capturedAt": capturedAt,
            "language": language.firestoreValue,
        ]
        doc["lat"] = lat as Any? ?? NSNull()
        doc["lng"] = lng as Any? ?? NSNull()
        let ref = try await collection().addDocument(data: doc)
        return ref.documentID
    }

    /// Oldest `capturedAt` first, so a backlog processes in the order it was actually spoken.
    public func listPending() async throws -> [PendingAudioCapture] {
        let snapshot = try await collection().order(by: "capturedAt", descending: false).getDocuments()
        return snapshot.documents.compactMap(Self.toPendingAudioCapture)
    }

    /// Live twin of `listPending` — used by the Capture tab's Quick Capture
    /// status indicator, which needs to react instantly as items are
    /// enqueued/removed rather than on a poll timer.
    public func observePending() -> AsyncThrowingStream<[PendingAudioCapture], Error> {
        AsyncThrowingStream { continuation in
            let registration = collection()
                .order(by: "capturedAt", descending: false)
                .addSnapshotListener { snapshot, error in
                    if let error {
                        continuation.finish(throwing: error)
                        return
                    }
                    continuation.yield((snapshot?.documents ?? []).compactMap(Self.toPendingAudioCapture))
                }
            continuation.onTermination = { _ in registration.remove() }
        }
    }

    public func remove(captureId: String) async throws {
        try await collection().document(captureId).delete()
    }

    private static func toPendingAudioCapture(_ doc: DocumentSnapshot) -> PendingAudioCapture? {
        guard let storagePath = doc.get("storagePath") as? String,
              let capturedAt = doc.get("capturedAt") as? Timestamp else { return nil }
        // Missing on docs written before this field existed — `.auto` matches
        // their actual prior behavior (the only mode that existed then).
        let language = (doc.get("language") as? String).map { CaptureLanguage(firestoreValue: $0) } ?? .auto
        return PendingAudioCapture(
            id: doc.documentID,
            storagePath: storagePath,
            capturedAt: capturedAt,
            lat: doc.get("lat") as? Double,
            lng: doc.get("lng") as? Double,
            language: language
        )
    }
}
