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
    private func rolesCollection() -> CollectionReference { userDoc().collection("roles") }
    private func categoriesCollection() -> CollectionReference { userDoc().collection("categories") }
    private func deviceTokenUsageCollection() -> CollectionReference { userDoc().collection("deviceTokenUsage") }
    private func cloudTokenUsageCollection() -> CollectionReference { userDoc().collection("cloudTokenUsage") }
    private func correctionsCollection() -> CollectionReference { userDoc().collection("corrections") }
    private func attachmentsCollection(entryId: String) -> CollectionReference {
        entriesCollection().document(entryId).collection("attachments")
    }
    private func appFeedbackCollection() -> CollectionReference { userDoc().collection("appFeedback") }

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

    public func observeRoles() -> AsyncThrowingStream<[ParticipantRole], Error> {
        observeDecodedArray(
            query: rolesCollection().order(by: "createdAt", descending: false),
            as: ParticipantRole.self
        )
    }

    public func createRole(name: String) async throws -> ParticipantRole {
        let role = ParticipantRole(name: name)
        let ref = try rolesCollection().addDocument(from: role)
        return try await waitForPendingWrite(at: ref) { try $0.data(as: ParticipantRole.self) } ?? role
    }

    public func renameRole(roleId: String, name: String) async throws {
        try await rolesCollection().document(roleId).updateData(["name": name])
    }

    public func deleteRole(roleId: String) async throws {
        try await rolesCollection().document(roleId).delete()
    }

    public func observeCategories() -> AsyncThrowingStream<[CustomCategory], Error> {
        observeDecodedArray(
            query: categoriesCollection().order(by: "createdAt", descending: false),
            as: CustomCategory.self
        )
    }

    public func createCategory(name: String) async throws -> CustomCategory {
        let category = CustomCategory(name: name)
        let ref = try categoriesCollection().addDocument(from: category)
        return try await waitForPendingWrite(at: ref) { try $0.data(as: CustomCategory.self) } ?? category
    }

    public func observeDeviceTokenUsage() -> AsyncThrowingStream<TokenUsageWeek?, Error> {
        observeDecodedDocument(deviceTokenUsageCollection().document(currentIsoWeekId()))
    }

    public func recordOnDeviceTokenUsage(inputTokens: Int, outputTokens: Int) async throws {
        try await deviceTokenUsageCollection().document(currentIsoWeekId()).setData([
            "inputTokens": FieldValue.increment(Int64(inputTokens)),
            "outputTokens": FieldValue.increment(Int64(outputTokens)),
            "requestCount": FieldValue.increment(Int64(1)),
            "weekStart": currentIsoWeekStart(),
            "updatedAt": FieldValue.serverTimestamp(),
        ], merge: true)
    }

    public func observeCloudTokenUsage() -> AsyncThrowingStream<TokenUsageWeek?, Error> {
        observeDecodedDocument(cloudTokenUsageCollection().document(currentIsoWeekId()))
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

    public func listAttachments(entryId: String) async throws -> [Attachment] {
        let snapshot = try await attachmentsCollection(entryId: entryId)
            .order(by: "uploadedAt")
            .getDocuments()
        return snapshot.documents.compactMap { try? $0.data(as: Attachment.self) }
    }

    public func uploadAttachment(
        entryId: String,
        fileURL: URL,
        fileName: String,
        contentType: String,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws -> Attachment {
        let sanitizedFileName = Self.sanitizeFileNameComponent(fileName)
        let storagePath = "users/\(uid)/entries/\(entryId)/attachments/\(Int(Date().timeIntervalSince1970 * 1000))_\(sanitizedFileName)"
        let attachmentRef = storage.reference(withPath: storagePath)
        let metadata = StorageMetadata()
        metadata.contentType = contentType

        // putFile streams from disk rather than loading the whole file into
        // memory — attachments can be up to 100MB.
        let uploadedMetadata = try await attachmentRef.putFileAsync(from: fileURL, metadata: metadata) { progress in
            onProgress(progress?.fractionCompleted ?? 0)
        }
        let downloadURL = try await attachmentRef.downloadURL()

        let data: [String: Any] = [
            "fileName": fileName,
            "contentType": contentType,
            "fileSize": uploadedMetadata.size,
            "storagePath": storagePath,
            "downloadURL": downloadURL.absoluteString,
            "uploadedAt": Timestamp(date: Date()),
            "note": "",
        ]
        let ref = try await attachmentsCollection(entryId: entryId).addDocument(data: data)
        return Attachment(
            id: ref.documentID,
            fileName: fileName,
            contentType: contentType,
            fileSize: uploadedMetadata.size,
            storagePath: storagePath,
            downloadURL: downloadURL.absoluteString,
            uploadedAt: Timestamp(date: Date()),
            note: ""
        )
    }

    public func updateAttachmentNote(entryId: String, attachmentId: String, note: String) async throws {
        try await attachmentsCollection(entryId: entryId).document(attachmentId).updateData(["note": note])
    }

    public func submitFeedback(
        imageData: Data,
        region: FeedbackRegion?,
        description: String,
        screenName: String,
        appVersion: String,
        buildNumber: String,
        osVersion: String,
        deviceModel: String,
        locale: String
    ) async throws -> AppFeedback {
        let ref = appFeedbackCollection().document()
        let storagePath = "users/\(uid)/appFeedback/\(ref.documentID)/screenshot.jpg"
        let screenshotRef = storage.reference(withPath: storagePath)
        let metadata = StorageMetadata()
        metadata.contentType = "image/jpeg"
        _ = try await screenshotRef.putDataAsync(imageData, metadata: metadata)
        let downloadURL = try await screenshotRef.downloadURL()

        var data: [String: Any] = [
            "description": description,
            "screenshotPath": storagePath,
            "downloadURL": downloadURL.absoluteString,
            "appVersion": appVersion,
            "buildNumber": buildNumber,
            "osVersion": osVersion,
            "deviceModel": deviceModel,
            "screenName": screenName,
            "locale": locale,
            "status": "pending",
            "createdAt": FieldValue.serverTimestamp(),
        ]
        if let region {
            data["region"] = ["x": region.x, "y": region.y, "w": region.w, "h": region.h]
        }
        try await ref.setData(data)

        return AppFeedback(
            id: ref.documentID,
            description: description,
            screenshotPath: storagePath,
            downloadURL: downloadURL.absoluteString,
            region: region,
            appVersion: appVersion,
            buildNumber: buildNumber,
            osVersion: osVersion,
            deviceModel: deviceModel,
            screenName: screenName,
            locale: locale,
            status: "pending"
        )
    }

    public func deleteAttachment(entryId: String, attachment: Attachment) async throws {
        try await storage.reference(withPath: attachment.storagePath).delete()
        // An Attachment read back from Firestore always has an id; force-unwrap is safe here.
        try await attachmentsCollection(entryId: entryId).document(attachment.id!).delete()
    }

    public func downloadAttachment(
        entryId: String,
        attachment: Attachment,
        onProgress: @escaping @Sendable (Double) -> Void
    ) async throws -> URL {
        let cacheDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("attachments", isDirectory: true)
        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)

        let sanitizedFileName = Self.sanitizeFileNameComponent(attachment.fileName)
        let localURL = cacheDirectory.appendingPathComponent("\(attachment.id!)_\(sanitizedFileName)")
        if FileManager.default.fileExists(atPath: localURL.path) {
            return localURL
        }

        let storageRef = storage.reference(withPath: attachment.storagePath)
        return try await storageRef.writeAsync(toFile: localURL) { progress in
            onProgress(progress?.fractionCompleted ?? 0)
        }
    }

    private static func sanitizeFileNameComponent(_ fileName: String) -> String {
        String(fileName.map { $0.isLetter || $0.isNumber || $0 == "." || $0 == "-" || $0 == "_" ? $0 : "_" })
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

    private func observeDecodedDocument<T: Decodable & Sendable>(
        _ document: DocumentReference
    ) -> AsyncThrowingStream<T?, Error> {
        AsyncThrowingStream { continuation in
            let registration = document.addSnapshotListener { snapshot, error in
                if let error {
                    continuation.finish(throwing: error)
                    return
                }
                continuation.yield(try? snapshot?.data(as: T.self))
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
