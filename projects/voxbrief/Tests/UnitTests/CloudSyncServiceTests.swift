import XCTest
@testable import Voxbrief

final class CloudSyncServiceTests: XCTestCase {
    func testVoiceNotePayloadAndRecordNameRoundTrip() throws {
        let original = VoiceNote(
            duration: 95,
            title: "Q4 Roadmap Sync",
            summary: "Discussed Mac meeting capture and iCloud sync.",
            rawTranscript: "we should ship mac meeting capture",
            cleanedNote: "We should ship Mac meeting capture.",
            actionItems: ["Ship 1.39.0"],
            completedActionItems: ["Ship 1.39.0"],
            tags: ["#roadmap"],
            status: .ready,
            source: .macMeeting
        )

        let recordName = CloudSyncCodec.recordName(kind: .note, id: original.id)
        let parsed = CloudSyncCodec.parseRecordName(recordName)
        XCTAssertEqual(parsed?.kind, .note)
        XCTAssertEqual(parsed?.id, original.id)

        let data = try CloudSyncCodec.encodePayload(original)
        let decoded = try CloudSyncCodec.decodePayload(VoiceNote.self, from: data)
        XCTAssertEqual(decoded.id, original.id)
        XCTAssertEqual(decoded.title, original.title)
        XCTAssertEqual(decoded.source, .macMeeting)
        XCTAssertEqual(decoded.completedActionItems, ["Ship 1.39.0"])
    }

    func testDictionaryEntryPayloadAndRecordNameRoundTrip() throws {
        let createdAt = Date(timeIntervalSince1970: 1_700_000_000)
        let entry = DictionaryEntry(term: "WhisperKit", aliases: ["whisper kit"], contextHint: "ASR library", createdAt: createdAt)
        let recordName = CloudSyncCodec.recordName(kind: .dictionary, id: entry.id)
        let parsed = CloudSyncCodec.parseRecordName(recordName)
        XCTAssertEqual(parsed?.kind, .dictionary)
        XCTAssertEqual(parsed?.id, entry.id)

        let data = try CloudSyncCodec.encodePayload(entry)
        let decoded = try CloudSyncCodec.decodePayload(DictionaryEntry.self, from: data)
        XCTAssertEqual(decoded, entry)
    }

    func testTemplatePayloadAndRecordNameRoundTrip() throws {
        let createdAt = Date(timeIntervalSince1970: 1_700_000_000)
        let template = NoteTemplate(
            name: "1:1 Notes",
            summary: "Weekly 1:1 check-in",
            sections: [TemplateSection(fieldKey: "updates", title: "Updates", instructions: "Key updates", style: .bullet)],
            isBuiltIn: false,
            createdAt: createdAt
        )
        let recordName = CloudSyncCodec.recordName(kind: .template, id: template.id)
        let parsed = CloudSyncCodec.parseRecordName(recordName)
        XCTAssertEqual(parsed?.kind, .template)
        XCTAssertEqual(parsed?.id, template.id)

        let data = try CloudSyncCodec.encodePayload(template)
        let decoded = try CloudSyncCodec.decodePayload(NoteTemplate.self, from: data)
        XCTAssertEqual(decoded, template)
    }

    func testParseInvalidRecordNameReturnsNil() {
        XCTAssertNil(CloudSyncCodec.parseRecordName("unknown-123"))
        XCTAssertNil(CloudSyncCodec.parseRecordName("note-not-a-uuid"))
    }

    func testConflictResolutionPreservesReadyNoteOverDraft() {
        let id = UUID()
        let older = Date(timeIntervalSince1970: 1_700_000_000)
        let newer = Date(timeIntervalSince1970: 1_700_001_000)

        let localReady = VoiceNote(id: id, createdAt: older, modifiedAt: older, title: "Finished", cleanedNote: "Done", status: .ready)
        let remoteDraft = VoiceNote(id: id, createdAt: older, modifiedAt: newer, title: "Processing", cleanedNote: "", status: .transcribingASR)

        let resolved = CloudSyncCodec.resolveConflict(local: localReady, remote: remoteDraft)
        XCTAssertEqual(resolved.status, .ready)
        XCTAssertEqual(resolved.title, "Finished")
    }

    func testConflictResolutionPicksNewerAndUnionsCompletedActionItems() {
        let id = UUID()
        let older = Date(timeIntervalSince1970: 1_700_000_000)
        let newer = Date(timeIntervalSince1970: 1_700_001_000)

        let local = VoiceNote(
            id: id,
            createdAt: older,
            modifiedAt: older,
            title: "Old Title",
            actionItems: ["Task A", "Task B"],
            completedActionItems: ["Task A"],
            status: .ready
        )
        let remote = VoiceNote(
            id: id,
            createdAt: older,
            modifiedAt: newer,
            title: "New Title",
            actionItems: ["Task A", "Task B"],
            completedActionItems: ["Task B"],
            status: .ready
        )

        let resolved = CloudSyncCodec.resolveConflict(local: local, remote: remote)
        XCTAssertEqual(resolved.title, "New Title")
        XCTAssertEqual(Set(resolved.completedActionItems), Set(["Task A", "Task B"]))
    }

    func testBackwardCompatibleModifiedAtDecoding() throws {
        let json = """
        {
          "id": "11111111-1111-1111-1111-111111111111",
          "createdAt": "2026-11-20T12:00:00Z",
          "duration": 10,
          "title": "Legacy Note",
          "summary": "",
          "rawTranscript": "hello",
          "cleanedNote": "Hello.",
          "requirements": [],
          "conditions": [],
          "actionItems": [],
          "tags": [],
          "status": "ready",
          "source": "phone_app",
          "isFavorite": false
        }
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(VoiceNote.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.modifiedAt, decoded.createdAt)
    }
}
