import XCTest
@testable import Voxbrief

final class AudioStorageManagementTests: XCTestCase {

    func testAudioStorageUsageAndPurge() throws {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("test_audio_storage_\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = AudioFileManager(baseDirectoryOverride: tempDir)

        // Initial state
        let initialUsage = manager.calculateStorageUsage()
        XCTAssertEqual(initialUsage.fileCount, 0)
        XCTAssertEqual(initialUsage.totalBytes, 0)

        // Create 2 fake audio files
        let file1URL = manager.newAudioFileURL()
        let file2URL = manager.newAudioFileURL()
        let sampleData = "Sample Audio Bytes".data(using: .utf8)!

        try sampleData.write(to: file1URL)
        try sampleData.write(to: file2URL)

        let populatedUsage = manager.calculateStorageUsage()
        XCTAssertEqual(populatedUsage.fileCount, 2)
        XCTAssertGreaterThan(populatedUsage.totalBytes, 0)

        // Purge with preserving file1
        let purged = manager.purgeAudioFiles(olderThanDays: 0, preservingFileNames: [file1URL.lastPathComponent])
        XCTAssertEqual(purged, 1)

        let remainingUsage = manager.calculateStorageUsage()
        XCTAssertEqual(remainingUsage.fileCount, 1)
        XCTAssertTrue(manager.fileExists(fileName: file1URL.lastPathComponent))
        XCTAssertFalse(manager.fileExists(fileName: file2URL.lastPathComponent))
    }
}
