import ContempoFirestore
import FirebaseCore
import FirebaseFirestore
import XCTest

/// Regression coverage for a real bug found this session: Swift's Codable
/// synthesis (confirmed against the actual vendored `FirebaseDataDecoder`,
/// not just stock `JSONDecoder`) does NOT fall back to a property's default
/// value when a key is missing from the decoded data — it throws
/// `keyNotFound`, even for a property with a memberwise-init default. Only
/// `Optional<T>` properties decode a missing key to `nil` without throwing.
///
/// `Attachment.note` and `Entry.roleId`/`roleName` were both added after
/// real documents already existed without them — if either were declared as
/// a non-optional `String` (as most of Entry's other String fields
/// currently are, e.g. `audioUrl`/`rawTranscript`/`mileageCaptureMethod`),
/// any `try? doc.data(as:)` call site (every one in this codebase) would
/// silently drop that document from its list the moment this shipped,
/// rather than erroring loudly. These tests assert that decoding a document
/// written before either field existed does NOT throw.
final class FirestoreMissingKeyDecodingTests: XCTestCase {
    /// `@DocumentID` requires a `DocumentReference` in the decoder's
    /// userInfo regardless of whether an "id" key is even present in the
    /// data — a bare `[String: Any]` decode throws
    /// `decodingIsNotSupported` without one. A named (non-default)
    /// `FirebaseApp` with placeholder options is enough to construct a real
    /// `DocumentReference` for this purpose; nothing here ever performs
    /// network I/O, so no emulator/project is needed.
    private static let testApp: FirebaseApp = {
        let options = FirebaseOptions(googleAppID: "1:0:ios:0000000000000000", gcmSenderID: "0")
        options.projectID = "demo-contempo-tests"
        // FirebaseAuth's component system eagerly initializes an Auth
        // instance for every configured app (even a named, non-default one
        // used only to obtain a DocumentReference for decoding) and traps
        // if apiKey is nil — never used to actually authenticate anything here.
        options.apiKey = "test-api-key"
        let name = "FirestoreMissingKeyDecodingTestsApp"
        if let existing = FirebaseApp.app(name: name) { return existing }
        FirebaseApp.configure(name: name, options: options)
        return FirebaseApp.app(name: name)!
    }()

    private func documentReference(collection: String, id: String) -> DocumentReference {
        Firestore.firestore(app: Self.testApp).collection(collection).document(id)
    }

    func testAttachmentDecodesWithoutThrowingWhenNoteFieldIsMissing() throws {
        let legacyDocument: [String: Any] = [
            "fileName": "receipt.pdf",
            "contentType": "application/pdf",
            "fileSize": 12345,
            "storagePath": "users/abc/entries/123/attachments/receipt.pdf",
            "downloadURL": "https://example.com/receipt.pdf",
            "uploadedAt": Timestamp(date: Date()),
            // Deliberately no "note" key — simulates a doc written before Attachment.note existed.
        ]
        let ref = documentReference(collection: "attachments", id: "att-1")

        let attachment = try Firestore.Decoder().decode(Attachment.self, from: legacyDocument, in: ref)
        XCTAssertNil(attachment.note)
        XCTAssertEqual(attachment.fileName, "receipt.pdf")
    }

    func testEntryDecodesWithoutThrowingWhenRoleFieldsAreMissing() throws {
        let legacyDocument: [String: Any] = [
            "propertyId": "",
            "propertyName": "123 Ocean Ave",
            "task": "Cleaned unit",
            "durationMinutes": 45,
            "category": "turnover",
            "status": "confirmed",
            "source": "manual",
            "activityDate": Timestamp(date: Date()),
            "loggedAt": Timestamp(date: Date()),
            "isVague": false,
            "isBackfilled": false,
            "daysLate": 0,
            "riskReasons": [String](),
            "photoUrls": [String](),
            "inProgress": false,
            "isTrip": false,
            "mileageCaptureMethod": "",
            "miles": 0.0,
            "audioUrl": "",
            "rawTranscript": "",
            // Deliberately no "roleId"/"roleName" keys — simulates every
            // entry that existed before the roles feature shipped.
        ]
        let ref = documentReference(collection: "entries", id: "entry-1")

        let entry = try Firestore.Decoder().decode(Entry.self, from: legacyDocument, in: ref)
        XCTAssertNil(entry.roleId)
        XCTAssertNil(entry.roleName)
        // The default-to-"me" behavior the whole roles feature depends on.
        XCTAssertTrue(entry.isOwnerHours)
    }

    /// A role-tagged entry (post-migration) must still round-trip correctly
    /// — this isn't just a "missing key" concern, the present-and-populated
    /// case needs to keep working too.
    func testEntryWithRoleFieldsPresentDecodesThem() throws {
        let document: [String: Any] = [
            "propertyId": "",
            "propertyName": "123 Ocean Ave",
            "task": "Cleaned unit",
            "durationMinutes": 45,
            "category": "turnover",
            "status": "confirmed",
            "source": "manual",
            "activityDate": Timestamp(date: Date()),
            "loggedAt": Timestamp(date: Date()),
            "isVague": false,
            "isBackfilled": false,
            "daysLate": 0,
            "riskReasons": [String](),
            "photoUrls": [String](),
            "inProgress": false,
            "isTrip": false,
            "mileageCaptureMethod": "",
            "miles": 0.0,
            "audioUrl": "",
            "rawTranscript": "",
            "roleId": "role-1",
            "roleName": "Cleaner",
        ]
        let ref = documentReference(collection: "entries", id: "entry-2")

        let entry = try Firestore.Decoder().decode(Entry.self, from: document, in: ref)
        XCTAssertEqual(entry.roleId, "role-1")
        XCTAssertEqual(entry.roleName, "Cleaner")
        XCTAssertFalse(entry.isOwnerHours)
    }
}
