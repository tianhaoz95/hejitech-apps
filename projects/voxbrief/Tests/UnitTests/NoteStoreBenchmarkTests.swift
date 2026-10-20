import XCTest
@testable import Voxbrief

/// 09: how long the note store takes to load and save with a big library (2,000 notes of
/// ~5-minute memos with timings). Prints the numbers; asserts only generous ceilings so it
/// doesn't flake on slow CI machines.
@MainActor
final class NoteStoreBenchmarkTests: XCTestCase {
    static func fixture(count: Int) -> [VoiceNote] {
        let sentence = "So for the contractor I need to ask about the cabinet lead time and whether the permit covers moving the sink."
        return (0..<count).map { index in
            let words = Array(repeating: sentence, count: 35).joined(separator: " ")
            let segments = (0..<60).map { TranscriptTimingSegment(start: Double($0) * 5, end: Double($0) * 5 + 5, text: sentence) }
            return VoiceNote(
                createdAt: Date(timeIntervalSince1970: 1_700_000_000 + Double(index) * 3600),
                duration: 300,
                audioFileName: "\(index).m4a",
                title: "Note \(index)",
                summary: "Summary of note \(index).",
                rawTranscript: words,
                cleanedNote: "# Note \(index)\n\n" + words,
                actionItems: ["Ask about lead time", "Check the permit"],
                tags: ["#home"],
                templateSections: [TemplateSectionContent(title: "Action Items", style: .checklist, items: ["Ask about lead time"])],
                transcriptSegments: segments
            )
        }
    }

    /// The repository hands its snapshot to the writer from a Task, so wait for the file itself.
    static func waitForWrite(of url: URL, after date: Date, repository: NoteRepository) async throws {
        for _ in 0..<600 {
            await repository.waitForPendingPersistence()
            if let modified = (try? FileManager.default.attributesOfItem(atPath: url.path))?[.modificationDate] as? Date, modified > date {
                return
            }
            try await Task.sleep(for: .milliseconds(10))
        }
        XCTFail("store was never written")
    }

    func testLoadAndSaveTwoThousandNotes() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("bench-\(UUID()).json")
        defer { try? FileManager.default.removeItem(at: url) }

        let writer = NoteRepository(customStorageURL: url)
        writer.restoreAllNotes(importedNotes: Self.fixture(count: 2000))
        // The empty store first gets the sample notes; wait for the big write after them.
        for _ in 0..<1000 {
            await writer.waitForPendingPersistence()
            let size = (try? FileManager.default.attributesOfItem(atPath: url.path))?[.size] as? Int ?? 0
            if size > 1_000_000 { break }
            try await Task.sleep(for: .milliseconds(20))
        }
        let bytes = (try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0

        let loadStart = ContinuousClock.now
        let reader = NoteRepository(customStorageURL: url)
        let loadTime = ContinuousClock.now - loadStart
        XCTAssertGreaterThanOrEqual(reader.notes.count, 2000, "plus the sample notes an empty store starts with")

        let before = try FileManager.default.attributesOfItem(atPath: url.path)[.modificationDate] as? Date ?? .distantPast
        let saveStart = ContinuousClock.now
        reader.toggleFavorite(id: reader.notes[0].id)
        try await Self.waitForWrite(of: url, after: before, repository: reader)
        let saveTime = ContinuousClock.now - saveStart

        print("[NoteStoreBenchmark] 2000 notes, \(bytes / 1024) KB on disk, load \(loadTime), one-edit save \(saveTime)")
        XCTAssertLessThan(loadTime, .seconds(30))
    }
}
