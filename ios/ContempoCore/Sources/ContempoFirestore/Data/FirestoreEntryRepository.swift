import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage
import Foundation

private let firestoreBatchLimit = 500

public final class FirestoreEntryRepository: EntryRepository, @unchecked Sendable {
    private let firestore: Firestore
    private let auth: Auth
    private let storage: Storage

    public init(firestore: Firestore, auth: Auth, storage: Storage) {
        self.firestore = firestore
        self.auth = auth
        self.storage = storage
    }

    private var uid: String {
        guard let uid = auth.currentUser?.uid else {
            preconditionFailure("FirestoreEntryRepository used before sign-in")
        }
        return uid
    }

    private func userDoc() -> DocumentReference { firestore.collection("users").document(uid) }
    private func entriesCollection() -> CollectionReference { userDoc().collection("entries") }
    private func propertiesCollection() -> CollectionReference { userDoc().collection("properties") }
    private func correctionsCollection() -> CollectionReference { userDoc().collection("corrections") }

    public func observeEntries() -> AsyncThrowingStream<[Entry], Error> {
        observeDecodedArray(
            query: entriesCollection().order(by: "activityDate", descending: true),
            as: Entry.self
        )
    }

    public func observeProperties() -> AsyncThrowingStream<[Property], Error> {
        observeDecodedArray(
            query: propertiesCollection().order(by: "createdAt", descending: false),
            as: Property.self
        )
    }

    public func createProperty(name: String) async throws -> Property {
        let property = Property(name: name)
        let ref = try propertiesCollection().addDocument(from: property)
        return try await waitForPendingWrite(at: ref) { try $0.data(as: Property.self) } ?? property
    }

    public func createEntry(_ entry: Entry) async throws -> String {
        let ref = try entriesCollection().addDocument(from: entry)
        return ref.documentID
    }

    public func newEntryId() -> String { entriesCollection().document().documentID }

    public func getEntry(entryId: String) async throws -> Entry? {
        let snapshot = try await entriesCollection().document(entryId).getDocument()
        return try snapshot.data(as: Entry.self)
    }

    public func findOpenEntry(isTrip: Bool) async throws -> Entry? {
        let snapshot = try await entriesCollection()
            .whereField("inProgress", isEqualTo: true)
            .whereField("isTrip", isEqualTo: isTrip)
            .limit(to: 1)
            .getDocuments()
        guard let doc = snapshot.documents.first else { return nil }
        return try doc.data(as: Entry.self)
    }

    public func updateEntry(entryId: String, entry: Entry) async throws {
        try entriesCollection().document(entryId).setData(from: entry)
    }

    public func deleteEntry(entryId: String) async throws {
        try await entriesCollection().document(entryId).delete()
    }

    public func deleteEntries(entryIds: [String]) async throws {
        for chunk in entryIds.chunked(into: firestoreBatchLimit) {
            let batch = firestore.batch()
            for entryId in chunk {
                batch.deleteDocument(entriesCollection().document(entryId))
            }
            try await batch.commit()
        }
    }

    public func attachPhoto(entryId: String, imageData: Data) async throws -> String {
        let photoRef = storage.reference()
            .child("users/\(uid)/entries/\(entryId)/\(Int(Date().timeIntervalSince1970 * 1000)).jpg")
        let metadata = StorageMetadata()
        metadata.contentType = "image/jpeg"
        _ = try await photoRef.putDataAsync(imageData, metadata: metadata)
        let downloadURL = try await photoRef.downloadURL()
        try await entriesCollection().document(entryId).updateData([
            "photoUrls": FieldValue.arrayUnion([downloadURL.absoluteString]),
        ])
        return downloadURL.absoluteString
    }

    public func recordCorrection(entryId: String, fieldName: String, aiValue: String, finalValue: String) async throws {
        let correction: [String: Any] = [
            "entryId": entryId,
            "fieldName": fieldName,
            "aiValue": aiValue,
            "finalValue": finalValue,
            "recordedAt": Timestamp(date: Date()),
        ]
        _ = try await correctionsCollection().addDocument(data: correction)
    }

    /// Firestore's `addDocument(from:)` fires its write in the background and
    /// returns a locally-generated `DocumentReference` immediately; this waits
    /// for that write to actually land (matching Android's `.add(entry).await()`
    /// semantics, which block on server ack) by re-reading the document once
    /// a snapshot listener reports it as no longer pending local writes.
    private func waitForPendingWrite<T>(
        at ref: DocumentReference,
        decode: @escaping (DocumentSnapshot) throws -> T?
    ) async throws -> T? {
        try await withCheckedThrowingContinuation { continuation in
            var registration: ListenerRegistration?
            registration = ref.addSnapshotListener(includeMetadataChanges: true) { snapshot, error in
                if let error {
                    registration?.remove()
                    continuation.resume(throwing: error)
                    return
                }
                guard let snapshot, snapshot.exists, snapshot.metadata.hasPendingWrites == false else { return }
                registration?.remove()
                do {
                    continuation.resume(returning: try decode(snapshot))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func observeDecodedArray<T: Decodable & Sendable>(
        query: Query,
        as type: T.Type
    ) -> AsyncThrowingStream<[T], Error> {
        AsyncThrowingStream { continuation in
            let registration = query.addSnapshotListener { snapshot, error in
                if let error {
                    continuation.finish(throwing: error)
                    return
                }
                let values = (snapshot?.documents ?? []).compactMap { try? $0.data(as: T.self) }
                continuation.yield(values)
            }
            continuation.onTermination = { _ in registration.remove() }
        }
    }
}

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
