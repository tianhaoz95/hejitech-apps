import XCTest
@testable import LogCore

/// Photos attached to entries: `photo` system events that follow the entry through edits.
final class PhotoTests: XCTestCase {
    private let tap = Provenance(surface: .phone, input: .tap)

    private func service() throws -> LogService {
        var h = Household(id: H, babyId: B, bottleMl: 120, caregivers: [Caregiver(id: A, name: "Alex")])
        h.categories = EventRegistry.shared.categories.map(\.id)
        return LogService(store: try SQLiteLogStore.inMemory(), household: h, me: A, interpreter: VoiceInterpreter(model: KeywordDecisionModel()))
    }

    func testPhotosAttachToTheirEntryAndStayOutOfTheLog() async throws {
        let s = try service()
        let tummy = try await s.log(type: "tummy_time", fields: ["minutes": .number(10)], provenance: tap)
        let taken = Date().addingTimeInterval(-60)
        let p1 = try await s.attachPhoto(to: tummy, width: 2048, height: 1536, takenAt: taken)
        try await s.attachPhoto(to: tummy, width: 1536, height: 2048, takenAt: nil)
        let log = try await s.derived()
        let photos = log.photos(for: tummy)
        XCTAssertEqual(photos.count, 2)
        XCTAssertEqual(photos[0].id, p1.id)
        XCTAssertEqual(photos[0].path, EntryPhoto.path(for: p1.id))
        XCTAssertEqual(photos[0].storageKey, "\(H.uuidString.lowercased())/photos/\(p1.id.uuidString.lowercased()).jpg")
        XCTAssertEqual(Int(photos[0].takenAt.timeIntervalSince1970), Int(taken.timeIntervalSince1970))
        XCTAssertEqual(photos[0].width, 2048)
        // not an entry: not in effective, counted, duplicates or sessions
        XCTAssertFalse(log.effective.contains { $0.type == SystemType.photo })
        XCTAssertTrue(log.duplicates.isEmpty)
        XCTAssertEqual(log.allPhotos.count, 2)
        XCTAssertEqual(log.entry(for: photos[0])?.id, tummy.id)
    }

    func testPhotosFollowEditsAndUndoRemovesOne() async throws {
        let s = try service()
        let diaper = try await s.log(type: "diaper", fields: ["kind": .string("wet")], provenance: tap)
        let p = try await s.attachPhoto(to: diaper, width: 100, height: 100, takenAt: nil)
        let edited = try await s.edit(diaper.id, fields: ["kind": .string("dirty")])
        var log = try await s.derived()
        XCTAssertEqual(log.photos(for: edited).map(\.id), [p.id], "an edit keeps the entry's photos")
        XCTAssertEqual(log.entry(for: log.allPhotos[0])?.id, edited.id)
        let later = try await s.attachPhoto(to: edited, width: 100, height: 100, takenAt: Date())
        log = try await s.derived()
        XCTAssertEqual(log.photos(for: edited).count, 2)
        try await s.undo(later.id)
        log = try await s.derived()
        XCTAssertEqual(log.photos(for: edited).map(\.id), [p.id], "removing a photo is an undo")
        try await s.undo(edited.id)
        log = try await s.derived()
        XCTAssertEqual(log.photos(for: diaper).map(\.id), [p.id], "undoing the edit brings back the original, photos included")
        try await s.undo(diaper.id)
        log = try await s.derived()
        XCTAssertTrue(log.allPhotos.isEmpty, "an undone entry's photos leave the gallery")
    }

    func testASessionCollectsPhotosFromStartAndFinish() async throws {
        let s = try service()
        let start = try await s.log(type: "feed.bottle.start", occurredAt: Date().addingTimeInterval(-600), provenance: tap)
        try await s.attachPhoto(to: start, width: 10, height: 10, takenAt: Date().addingTimeInterval(-300))
        let finish = try await s.log(type: "feed.bottle.finish", fields: ["consumed_fraction": .number(1)], provenance: tap)
        try await s.attachPhoto(to: finish, width: 10, height: 10, takenAt: Date())
        let log = try await s.derived()
        XCTAssertEqual(log.photos(for: [start, finish]).count, 2)
        XCTAssertEqual(log.sessions.count, 1)
    }
}
