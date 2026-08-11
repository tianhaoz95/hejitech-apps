import ContempoCore
import FirebaseAuth
import FirebaseFirestore
import Foundation

public struct PendingTextCapture: Sendable, Identifiable, Equatable {
    public let id: String
    public let rawText: String
    public let capturedAt: Timestamp
    public let lat: Double?
    public let lng: Double?

    public init(id: String, rawText: String, capturedAt: Timestamp, lat: Double?, lng: Double?) {
        self.id = id
        self.rawText = rawText
        self.capturedAt = capturedAt
        self.lat = lat
        self.lng = lng
    }
}

/// Quick Capture's typed-text counterpart to `AudioCaptureQueue` — same
/// "immediate save, background parse" shape, but since text is small there's
/// no Storage upload step: the raw text lives directly on the queue doc, and
/// Firestore's own offline write queueing is durability enough (no local
/// file staging store needed, unlike audio's `PendingCaptureStore`, which
/// exists specifically because a Storage upload needs a real local file).
public final class TextCaptureQueue: @unchecked Sendable {
    private let firestore: Firestore
    private let auth: Auth

    public init(firestore: Firestore, auth: Auth) {
        self.firestore = firestore
        self.auth = auth
    }

    private var uid: String {
        guard let uid = auth.currentUser?.uid else {
            preconditionFailure("TextCaptureQueue used before sign-in")
        }
        return uid
    }

    private func collection() -> CollectionReference {
        firestore.collection("users").document(uid).collection("textCaptures")
    }

    @discardableResult
    public func enqueue(rawText: String, capturedAt: Timestamp = Timestamp(date: Date()), lat: Double?, lng: Double?) async throws -> String {
        var doc: [String: Any] = [
            "rawText": rawText,
            "capturedAt": capturedAt,
        ]
        doc["lat"] = lat as Any? ?? NSNull()
        doc["lng"] = lng as Any? ?? NSNull()
        let ref = try await collection().addDocument(data: doc)
        return ref.documentID
    }

    /// Oldest `capturedAt` first, so a backlog processes in the order it was actually typed.
    public func listPending() async throws -> [PendingTextCapture] {
        let snapshot = try await collection().order(by: "capturedAt", descending: false).getDocuments()
        return snapshot.documents.compactMap(Self.toPendingTextCapture)
    }

    /// Live twin of `listPending` — used by the Capture tab's Quick Capture
    /// status indicator, same role `AudioCaptureQueue.observePending()` plays
    /// for voice.
    public func observePending() -> AsyncThrowingStream<[PendingTextCapture], Error> {
        AsyncThrowingStream { continuation in
            let registration = collection()
                .order(by: "capturedAt", descending: false)
                .addSnapshotListener { snapshot, error in
                    if let error {
                        continuation.finish(throwing: error)
                        return
                    }
                    continuation.yield((snapshot?.documents ?? []).compactMap(Self.toPendingTextCapture))
                }
            continuation.onTermination = { _ in registration.remove() }
        }
    }

    public func remove(captureId: String) async throws {
        try await collection().document(captureId).delete()
    }

    private static func toPendingTextCapture(_ doc: DocumentSnapshot) -> PendingTextCapture? {
        guard let rawText = doc.get("rawText") as? String,
              let capturedAt = doc.get("capturedAt") as? Timestamp else { return nil }
        return PendingTextCapture(
            id: doc.documentID,
            rawText: rawText,
            capturedAt: capturedAt,
            lat: doc.get("lat") as? Double,
            lng: doc.get("lng") as? Double
        )
    }
}
